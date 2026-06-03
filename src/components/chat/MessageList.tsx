'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import MessageItem from './MessageItem'
import PollCard from './PollCard'
import TypingIndicator from './TypingIndicator'
import type { Tables } from '@/lib/supabase/database.types'

interface MessageListProps {
  roomId: string
  messages: any[]
  loading: boolean
  currentUserId: string
  isAdmin: boolean
  isConfessionBox: boolean
  accentColor: string
  blockedUserIds: string[]
  onReply: (messageId: string) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onPin: (messageId: string) => void
  onReport: (messageId: string) => void
  onBlock: (userId: string) => void
  onBookmark: (messageId: string) => void
  onJumpToMessage: (messageId: string) => void
}

export default function MessageList({
  roomId,
  messages,
  loading,
  currentUserId,
  isAdmin,
  isConfessionBox,
  accentColor,
  blockedUserIds,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReport,
  onBlock,
  onBookmark,
  onJumpToMessage,
}: MessageListProps) {
  const [polls, setPolls] = useState<Tables<'polls'>[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isScrolledUpRef = useRef(false)
  const supabase = createClient()

  useEffect(() => {
    loadPolls()
    const cleanup = subscribeToTyping()

    return () => {
      cleanup()
    }
  }, [roomId])

  useEffect(() => {
    if (!isScrolledUpRef.current && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (messages.length > 0) {
      setHasNewMessages(true)
    }
  }, [messages.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      const threshold = 100
      isScrolledUpRef.current = el.scrollHeight - el.scrollTop - el.clientHeight > threshold
      if (!isScrolledUpRef.current) {
        setHasNewMessages(false)
      }
    }

    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  async function loadPolls() {
    const { data } = await supabase
      .from('polls')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })

    if (data) setPolls(data)
  }

  function subscribeToTyping() {
    const channel = supabase.channel(`typing:${roomId}`, {
      config: { presence: { key: `typing-${roomId}` } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const typing: string[] = []
        for (const key in state) {
          const presences = state[key] as any[]
          presences?.forEach((p) => {
            if (p.typing && p.user_id !== currentUserId && p.anonymous_name) {
              typing.push(p.anonymous_name)
            }
          })
        }
        setTypingUsers(typing)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setHasNewMessages(false)
  }

  // Merge messages and polls sorted by created_at
  const allItems = [
    ...messages.map((m) => ({ type: 'message' as const, data: m, ts: new Date(m.created_at).getTime() })),
    ...polls.map((p) => ({ type: 'poll' as const, data: p, ts: new Date(p.created_at).getTime() })),
  ].sort((a, b) => a.ts - b.ts)


  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-2">
            <div className="h-8 w-8 rounded-full skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 skeleton rounded-[8px]" />
              <div className="h-4 w-64 skeleton rounded-[8px]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-[17px] bg-primary-gradient shadow-glow-sm mb-4">
              <span className="text-2xl">👻</span>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No messages yet</h3>
            <p className="text-sm text-[rgba(255,255,255,0.45)] max-w-xs">
              Be the first to send a message in this room
            </p>
          </div>
        )}

        {/* Confession box notice */}
        {isConfessionBox && (
          <div className="px-4 py-3 bg-orange-500/5 border-b border-orange-500/20">
            <p className="text-xs text-orange-400 text-center">
              🔥 This room has no memory. Messages auto-delete after 1 hour.
            </p>
          </div>
        )}

        {/* Messages and polls interleaved by timestamp */}
        <div className="py-2">
          {allItems.map((item, idx) => {
            if (item.type === 'poll') {
              return (
                <div key={`poll-${item.data.id}`} className="px-4 py-2">
                  <PollCard
                    poll={item.data}
                    isAdmin={isAdmin}
                    currentUserId={currentUserId}
                  />
                </div>
              )
            }
            const msg = item.data
            const prevMsg = idx > 0 && allItems[idx - 1].type === 'message'
              ? allItems[idx - 1].data
              : null
            const isGroupStart =
              !prevMsg ||
              (prevMsg as any).user_id !== msg.user_id ||
              item.ts - allItems[idx - 1].ts > 5 * 60 * 1000
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                isOwn={msg.user_id === currentUserId}
                isGroupStart={isGroupStart}
                isAdmin={isAdmin}
                isBlocked={blockedUserIds.includes(msg.user_id)}
                isConfessionBox={isConfessionBox}
                currentUserId={currentUserId}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onPin={onPin}
                onReport={onReport}
                onBlock={onBlock}
                onBookmark={onBookmark}
                onJumpToMessage={onJumpToMessage}
              />
            )
          })}
        </div>

        {/* Typing indicator */}
        <TypingIndicator users={typingUsers} />

        <div ref={bottomRef} />
      </div>

      {/* New messages button */}
      {hasNewMessages && (
        <Button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-xl animate-slide-up glass-card text-white hover:bg-[rgba(255,255,255,0.14)]"
          size="sm"
        >
          <ArrowDown className="h-4 w-4 mr-1" />
          New messages
        </Button>
      )}
    </div>
  )
}
