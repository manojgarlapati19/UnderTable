'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMessages } from '@/hooks/useMessages'
import { usePresence } from '@/hooks/usePresence'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Pin, Settings, Search, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { setCurrentRoom } from '@/lib/utils/current-room'
import type { Tables } from '@/lib/supabase/database.types'

interface RoomPageProps {
  params: { roomId: string }
}

export default function ChatRoomPage({ params }: RoomPageProps) {
  const router = useRouter()
    // FIX: previously created once per render — hoist into a ref so a single
    // Supabase client (and its realtime listeners) is reused across re-renders.
    const supabase = useRef(createClient()).current

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

  // Confirmation dialogs
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [reportTarget, setReportTarget] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState<string>('Inappropriate')

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

  const onlineCount = visibleUsers.filter((u) => u.current_room === params.roomId).length

  useEffect(() => {
      let cancelled = false
      void (async () => {
        try {
          // FIX: previously all four calls fired in parallel without
          // awaiting. The cleanup ran `updateCurrentRoom(null)` on unmount,
          // but if the user navigated from room A to room B quickly the
          // cleanup could race with the new effect's mount and briefly
          // broadcast `null` before the new room was set. Run them in
          // sequence (load → load → load → load → update) so the state
          // transitions are deterministic.
          await checkRoomAccess()
          if (cancelled) return
          await Promise.all([loadRoom(), loadProfile(), loadBlocks()])
          if (cancelled) return

          try {
            updateCurrentRoom(params.roomId)
            setCurrentRoom(params.roomId)
          } catch (err) {
            console.error('Failed to update current room on mount:', err)
          }
        } finally {
          if (!cancelled) {
            setIsCheckingAccess(false)
          }
        }
      })()

      return () => {
        cancelled = true
        try {
          updateCurrentRoom(null)
          setCurrentRoom(null)
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
        .select('has_password')
        .eq('id', params.roomId)
        .single()

      if (roomData?.has_password) {
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
        // `is_active` omitted — see LeftSidebar.tsx comment. The column was
        // added in migration 005 which may not yet be applied to the target
        // Supabase project.
        .select('id, name, description, icon_emoji, accent_color, is_private, is_readonly, is_confession_box, has_password, message_ttl_seconds, message_ttl_hours, slow_mode_seconds, created_at')
        .eq('id', params.roomId)
        .single()

      if (data) setRoom(data as unknown as Tables<'rooms'>)
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
        let expiresAt: string | undefined
        if (room?.is_confession_box) {
          expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
        } else if (room?.message_ttl_seconds) {
          expiresAt = new Date(Date.now() + room.message_ttl_seconds * 1000).toISOString()
        }
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
      setDeleteTargetId(messageId)
    },
    []
  )

  async function confirmDelete() {
    if (!deleteTargetId) return
    try {
      await deleteMessage(deleteTargetId)
      toast.success('Message deleted')
    } catch {
      toast.error('Failed to delete message')
    } finally {
      setDeleteTargetId(null)
    }
  }

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
    (messageId: string) => {
      setReportTarget(messageId)
      setReportReason('Inappropriate')
    },
    []
  )

  async function submitReport() {
    if (!reportTarget || !profile) return
    try {
      await supabase.from('reports').insert({
        message_id: reportTarget,
        reported_by: profile.id,
        reason: reportReason,
      })
      toast.success('Message reported')
    } catch (err) {
      console.error('Failed to report message:', err)
      toast.error('Failed to report message')
    } finally {
      setReportTarget(null)
    }
  }

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

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete message?</DialogTitle>
            <DialogDescription>
              This will remove the message for everyone. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={!!reportTarget} onOpenChange={(open) => { if (!open) setReportTarget(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Report message</DialogTitle>
            <DialogDescription>
              Why are you reporting this message? Admins will review it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {(['Harassment', 'Spam', 'Inappropriate', 'Other'] as const).map((reason) => (
              <label
                key={reason}
                className={cn(
                  'flex items-center gap-3 rounded-[10px] border px-3 py-2 cursor-pointer transition-colors',
                  reportReason === reason
                    ? 'border-accent bg-[rgba(167,139,250,0.12)]'
                    : 'border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.04)]'
                )}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={reason}
                  checked={reportReason === reason}
                  onChange={() => setReportReason(reason)}
                  className="accent-[#A78BFA]"
                />
                <span className="text-sm text-white">{reason}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setReportTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitReport}>Submit Report</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
