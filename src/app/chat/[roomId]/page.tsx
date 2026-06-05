'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMessages } from '@/hooks/useMessages'
import { usePresence } from '@/hooks/usePresence'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils/cn'
import MessageList from '@/components/chat/MessageList'
import MessageInput from '@/components/chat/MessageInput'
import PinnedMessagesBar from '@/components/chat/PinnedMessagesBar'
import PollCreateModal from '@/components/chat/PollCreateModal'
import GifPickerModal from '@/components/chat/GifPickerModal'
import RoomSettingsModal from '@/components/chat/RoomSettingsModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pin, Settings, Search, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Tables } from '@/lib/supabase/database.types'

interface RoomPageProps {
  params: { roomId: string }
}

export default function ChatRoomPage({ params }: RoomPageProps) {
  const router = useRouter()
  const supabase = createClient()
  const notifications = useNotifications() || {}
  const notifyNewMessage = (notifications as any).notifyNewMessage || (() => {})

  const [room, setRoom] = useState<Tables<'rooms'> | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; senderName: string } | null>(null)
  const [showPollModal, setShowPollModal] = useState(false)
  const [showGifModal, setShowGifModal] = useState(false)
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])

  // Room settings state
  const [roomSettingsOpen, setRoomSettingsOpen] = useState(false)

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isCheckingAccess, setIsCheckingAccess] = useState(true)

  // Debounce search by 300ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const { messages, loading: messagesLoading, sendMessage, editMessage, deleteMessage } = useMessages({
    roomId: params.roomId,
  })

  const presence = usePresence()
  const updateCurrentRoom = presence?.updateCurrentRoom || (() => {})
  const setTyping = presence?.setTyping || (() => {})
  const visibleUsers = presence?.visibleUsers || []

  const onlineCount = visibleUsers.filter((u: any) => u.current_room === params.roomId).length

  useEffect(() => {
    checkRoomAccess()
    loadRoom()
    loadProfile()
    loadBlocks()

    try {
      updateCurrentRoom(params.roomId)
    } catch (err) {
      console.error('Failed to update current room on mount:', err)
    }

    return () => {
      try {
        updateCurrentRoom(null)
      } catch (err) {
        console.error('Failed to update current room on unmount:', err)
      }
    }
  }, [params.roomId])

  // Ctrl+F to open search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
        if (!isSearchOpen) {
          setSearchQuery('')
        }
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  async function checkRoomAccess() {
    try {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('room_password')
        .eq('id', params.roomId)
        .single()

      if (roomData && (roomData as any).room_password) {
        const hasAccess = sessionStorage.getItem(`room_access_${params.roomId}`)
        if (!hasAccess) {
          toast.error('This room is password protected')
          router.push('/chat')
          return
        }
      }
      setIsCheckingAccess(false)
    } catch (err) {
      console.error('Failed to check room access:', err)
      setIsCheckingAccess(false)
    }
  }

  async function loadRoom() {
    try {
      const { data } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', params.roomId)
        .single()

      if (data) setRoom(data)
    } catch (err) {
      console.error('Failed to load room:', err)
    }
  }

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) setProfile(data)
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }

  async function loadBlocks() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', user.id)

      if (data) setBlockedUserIds(data.map((b) => b.blocked_id))
    } catch (err) {
      console.error('Failed to load blocks:', err)
    }
  }

  const handleSend = useCallback(
    async (content: string, replyToId?: string | null) => {
      try {
        const expiresAt = room?.is_confession_box
          ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
          : undefined
        await sendMessage(content, replyToId, expiresAt)
      } catch (err) {
        console.error('Failed to send message:', err)
        toast.error('Failed to send message')
      }
    },
    [sendMessage, room]
  )

  const handleReply = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId)
      if (msg) {
        setReplyTo({
          id: msg.id,
          content: msg.content,
          senderName: msg.sender_name || 'Unknown',
        })
      }
    },
    [messages]
  )

  const handleEdit = useCallback(
    async (messageId: string, content: string) => {
      try {
        await editMessage(messageId, content)
      } catch {
        toast.error('Failed to edit message')
      }
    },
    [editMessage]
  )

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (confirm('Delete this message?')) {
        try {
          await deleteMessage(messageId)
        } catch {
          toast.error('Failed to delete message')
        }
      }
    },
    [deleteMessage]
  )

  const handlePin = useCallback(
    async (messageId: string) => {
      if (!profile || !room) return

      try {
        const { error } = await supabase.from('pinned_messages').insert({
          room_id: room.id,
          message_id: messageId,
          pinned_by: profile.id,
        })

        if (error) toast.error('Failed to pin message')
        else toast.success('Message pinned')
      } catch (err) {
        console.error('Failed to pin message:', err)
        toast.error('Failed to pin message')
      }
    },
    [profile, room, supabase]
  )

  const handleReport = useCallback(
    async (messageId: string) => {
      const reason = prompt('Select reason:\n1. Harassment\n2. Spam\n3. Inappropriate\n4. Other')
      if (!reason || !profile) return

      const reasonMap: Record<string, string> = {
        '1': 'Harassment', '2': 'Spam', '3': 'Inappropriate', '4': 'Other',
      }

      try {
        await supabase.from('reports').insert({
          message_id: messageId,
          reported_by: profile.id,
          reason: reasonMap[reason] || reason,
        })
        toast.success('Message reported')
      } catch (err) {
        console.error('Failed to report message:', err)
      }
    },
    [profile, supabase]
  )

  const handleBlock = useCallback(
    async (userId: string) => {
      if (!profile) return

      try {
        const { error } = await supabase.from('blocks').insert({
          blocker_id: profile.id,
          blocked_id: userId,
        })

        if (!error) {
          setBlockedUserIds([...blockedUserIds, userId])
          toast.success('User blocked. Their messages are now hidden.')
        }
      } catch (err) {
        console.error('Failed to block user:', err)
      }
    },
    [profile, blockedUserIds, supabase]
  )

  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      try {
        const el = document.getElementById(`msg-${messageId}`)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          el.classList.add('message-highlight')
        }
      } catch (err) {
        console.error('Failed to jump to message:', err)
      }
    },
    []
  )

  if (isCheckingAccess) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!room || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[rgba(255,255,255,0.45)]">Loading room...</p>
      </div>
    )
  }

  const isAdmin = profile.role === 'admin'
  const accentColor = room.accent_color || '#7C3AED'

  return (
    <>
      {/* Room Header */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '13px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xl">{room.icon_emoji}</span>
          <div>
            <h1 className="text-sm font-medium text-white">{room.name}</h1>
            {room.description && (
              <p className="text-xs text-[rgba(255,255,255,0.45)]">{room.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onlineCount > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
              {onlineCount}
            </Badge>
          )}

          {/* Search button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 rounded-[11px] transition-all duration-150',
              isSearchOpen ? 'bg-[rgba(167,139,250,0.2)] text-[#C4B5FD]' : ''
            )}
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="Search messages (Ctrl+F)"
          >
            <Search className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[11px]">
            <Pin className="h-4 w-4" />
          </Button>

          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-[11px]"
              onClick={() => setRoomSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {isSearchOpen && (
        <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.08)] glass-panel animate-slide-up">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[rgba(255,255,255,0.45)] shrink-0" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search messages in #${room.name}...`}
              className="flex-1 h-8 text-sm border-0 bg-transparent outline-none placeholder:text-[rgba(255,255,255,0.35)]"
              autoFocus
            />
            {debouncedSearch && (
              <span className="text-xs text-[rgba(255,255,255,0.45)]">
                {messages.filter((m) =>
                  m.content.toLowerCase().includes(debouncedSearch.toLowerCase())
                ).length} results
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-[8px] text-[rgba(255,255,255,0.45)] hover:text-white"
              onClick={() => { setIsSearchOpen(false); setSearchQuery('') }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Accent color accent bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: accentColor }} />

      {/* Pinned Messages Bar */}
      <PinnedMessagesBar roomId={params.roomId} accentColor={accentColor} />

      {/* Messages */}
      <MessageList
        roomId={params.roomId}
        messages={messages}
        loading={messagesLoading}
        currentUserId={profile.id}
        isAdmin={isAdmin}
        isConfessionBox={room.is_confession_box}
        accentColor={accentColor}
        blockedUserIds={blockedUserIds}
        searchQuery={debouncedSearch}
        isSearchOpen={isSearchOpen}
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPin={handlePin}
        onReport={handleReport}
        onBlock={handleBlock}
        onJumpToMessage={handleJumpToMessage}
      />

      {/* Message Input */}
      <MessageInput
        roomId={params.roomId}
        roomName={room.name}
        profileName={profile.anonymous_name}
        isReadonly={room.is_readonly}
        slowModeSeconds={room.slow_mode_seconds}
        isConfessionBox={room.is_confession_box}
        onSend={handleSend}
        onOpenPoll={() => setShowPollModal(true)}
        onOpenGif={() => setShowGifModal(true)}
        replyTo={replyTo}
        onDismissReply={() => setReplyTo(null)}
        onTypingChange={(typing) => setTyping(typing)}
      />

      {/* Poll Create Modal */}
      <PollCreateModal
        open={showPollModal}
        onOpenChange={setShowPollModal}
        roomId={params.roomId}
      />

      {/* GIF Picker Modal */}
      <GifPickerModal
        open={showGifModal}
        onOpenChange={setShowGifModal}
        onSelect={async (gifUrl) => {
          await handleSend(gifUrl, null)
        }}
      />

      {/* Room Settings Modal */}
      <RoomSettingsModal
        open={roomSettingsOpen}
        onOpenChange={setRoomSettingsOpen}
        room={room}
        isAdmin={isAdmin}
        onRoomUpdated={loadRoom}
      />
    </>
  )
}
