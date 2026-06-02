'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useMessages } from '@/hooks/useMessages'
import { usePresence } from '@/hooks/usePresence'
import { useNotifications } from '@/hooks/useNotifications'
import { getAvatarColor } from '@/lib/utils/avatar-color'
import { cn } from '@/lib/utils/cn'
import MessageList from '@/components/chat/MessageList'
import MessageInput from '@/components/chat/MessageInput'
import PinnedMessagesBar from '@/components/chat/PinnedMessagesBar'
import PollCreateModal from '@/components/chat/PollCreateModal'
import GifPickerModal from '@/components/chat/GifPickerModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pin, Users, Settings } from 'lucide-react'
import { toast } from 'sonner'
import type { Tables } from '@/lib/supabase/database.types'

interface RoomPageProps {
  params: { roomId: string }
}

export default function ChatRoomPage({ params }: RoomPageProps) {
  const router = useRouter()
  const supabase = createClient()
  const { notifyNewMessage } = useNotifications()

  const [room, setRoom] = useState<Tables<'rooms'> | null>(null)
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; senderName: string } | null>(null)
  const [showPollModal, setShowPollModal] = useState(false)
  const [showGifModal, setShowGifModal] = useState(false)
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([])
  const [onlineCount, setOnlineCount] = useState(0)

  const { messages, sendMessage, editMessage, deleteMessage } = useMessages({
    roomId: params.roomId,
  })

  const { updateCurrentRoom, setTyping } = usePresence()

  useEffect(() => {
    loadRoom()
    loadProfile()
    loadBlocks()
    updateCurrentRoom(params.roomId)

    return () => {
      updateCurrentRoom(null)
    }
  }, [params.roomId])

  async function loadRoom() {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', params.roomId)
      .single()

    if (data) setRoom(data)
  }

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) setProfile(data)
  }

  async function loadBlocks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)

    if (data) setBlockedUserIds(data.map((b) => b.blocked_id))
  }

  const handleSend = useCallback(
    async (content: string, replyToId?: string | null) => {
      // For confession box rooms, set expires_at to 1 hour
      const expiresAt = room?.is_confession_box
        ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
        : undefined
      await sendMessage(content, replyToId, expiresAt)
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
          senderName: msg.profiles?.anonymous_name || 'Unknown',
        })
      }
    },
    [messages]
  )

  const handleEdit = useCallback(
    async (messageId: string) => {
      // This is handled inline in MessageItem
    },
    []
  )

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (confirm('Delete this message?')) {
        await deleteMessage(messageId)
      }
    },
    [deleteMessage]
  )

  const handlePin = useCallback(
    async (messageId: string) => {
      if (!profile || !room) return

      const { error } = await supabase.from('pinned_messages').insert({
        room_id: room.id,
        message_id: messageId,
        pinned_by: profile.id,
      })

      if (!error) toast.success('Message pinned')
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

      await supabase.from('reports').insert({
        message_id: messageId,
        reported_by: profile.id,
        reason: reasonMap[reason] || reason,
      })

      toast.success('Message reported')
    },
    [profile, supabase]
  )

  const handleBlock = useCallback(
    async (userId: string) => {
      if (!profile || !confirm('Block this person? Their messages will be hidden from you.')) return

      const { error } = await supabase.from('blocks').insert({
        blocker_id: profile.id,
        blocked_id: userId,
      })

      if (!error) {
        setBlockedUserIds([...blockedUserIds, userId])
        toast.success('User blocked')
      }
    },
    [profile, blockedUserIds, supabase]
  )

  const handleBookmark = useCallback(
    async (messageId: string) => {
      if (!profile) return

      const { error } = await supabase.from('bookmarks').insert({
        user_id: profile.id,
        message_id: messageId,
      })

      if (!error) toast.success('Message bookmarked')
    },
    [profile, supabase]
  )

  const handleJumpToMessage = useCallback(
    (messageId: string) => {
      const el = document.getElementById(`msg-${messageId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('message-highlight')
      }
    },
    []
  )

  if (!room || !profile) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Loading room...</p>
      </div>
    )
  }

  const isAdmin = profile.role === 'admin'
  const accentColor = room.accent_color || '#7C3AED'

  return (
    <>
      {/* Room Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0"
        style={{ borderBottomColor: accentColor, borderBottomWidth: 2 }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{room.icon_emoji}</span>
          <div>
            <h1 className="text-sm font-semibold text-foreground">{room.name}</h1>
            {room.description && (
              <p className="text-xs text-muted-foreground">{room.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onlineCount > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              {onlineCount}
            </Badge>
          )}

          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pin className="h-4 w-4" />
          </Button>

          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Pinned Messages Bar */}
      <PinnedMessagesBar roomId={params.roomId} accentColor={accentColor} />

      {/* Messages */}
      <MessageList
        roomId={params.roomId}
        currentUserId={profile.id}
        isAdmin={isAdmin}
        isConfessionBox={room.is_confession_box}
        accentColor={accentColor}
        blockedUserIds={blockedUserIds}
        onReply={handleReply}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPin={handlePin}
        onReport={handleReport}
        onBlock={handleBlock}
        onBookmark={handleBookmark}
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
    </>
  )
}
