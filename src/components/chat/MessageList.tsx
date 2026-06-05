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
  searchQuery?: string
  isSearchOpen?: boolean
  onReply: (messageId: string) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onPin: (messageId: string) => void
  onReport: (messageId: string) => void
  onBlock: (userId: string) => void
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
  searchQuery = '',
  isSearchOpen = false,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReport,
  onBlock,
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

    let typingChannel: ReturnType<typeof supabase.channel> | null = null
    let pollsChannel: ReturnType<typeof supabase.channel> | null = null

    const setupChannels = async () => {
      try {
        typingChannel = supabase.channel(`typing:${roomId}`, {
          config: { presence: { key: `typing-${roomId}` } },
        })

        typingChannel
          .on('presence', { event: 'sync' }, () => {
            try {
              const state = typingChannel?.presenceState() || {}
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
            } catch (err) {
              console.error('Typing presence sync error:', err)
            }
          })
          .subscribe((status, err) => {
            if (err) {
              console.error('Typing channel subscribe error:', err)
            }
          })
      } catch (err) {
        console.error('Failed to setup typing channel:', err)
      }

      try {
        pollsChannel = supabase
          .channel(`polls:${roomId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'polls',
              filter: `room_id=eq.${roomId}`,
            },
            () => {
              loadPolls()
            }
          )
          .subscribe((status, err) => {
            if (err) {
              console.error('Polls channel subscribe error:', err)
            }
          })
      } catch (err) {
        console.error('Failed to setup polls channel:', err)
      }
    }

    setupChannels()

    return () => {
      if (typingChannel) {
        try {
          supabase.removeChannel(typingChannel)
        } catch (err) {
          console.error('Failed to remove typing channel:', err)
        }
      }
      if (pollsChannel) {
        try {
          supabase.removeChannel(pollsChannel)
        } catch (err) {
          console.error('Failed to remove polls channel:', err)
        }
      }
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
    try {
      const { data } = await supabase
        .from('polls')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })

      if (data) setPolls(data)
    } catch (err) {
      console.error('Failed to load polls:', err)
    }
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setHasNewMessages(false)
  }

  // Filter messages by search query
  const filteredMessages = isSearchOpen && searchQuery
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages

  const searchResultCount = filteredMessages.length

  // Merge messages and polls sorted by created_at
  const allItems = [
    ...filteredMessages.map((m) => ({ type: 'message' as const, data: m, ts: new Date(m.created_at).getTime() })),
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
    <div className="relative flex-1 flex flex-col overflow-hidden" style={{ background: 'transparent' }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ background: 'transparent' }}>
        {/* Search results header */}
        {isSearchOpen && searchQuery && (
          <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.08)]">
            <p className="text-xs text-[rgba(255,255,255,0.45)]">
              Found {searchResultCount} result{searchResultCount !== 1 ? 's' : ''} for &quot;{searchQuery}&quot;
            </p>
          </div>
        )}

        {/* Empty state */}
        {filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-[17px] bg-primary-gradient shadow-glow-sm mb-4">
              <span className="text-2xl">👻</span>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              {isSearchOpen && searchQuery ? 'No results found' : 'No messages yet'}
            </h3>
            <p className="text-sm text-[rgba(255,255,255,0.45)] max-w-xs">
              {isSearchOpen && searchQuery
                ? 'Try a different search term'
                : 'Be the first to send a message in this room'}
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

            // Dim non-matching messages when search is active
            const isDimmed = isSearchOpen && searchQuery &&
              !msg.content.toLowerCase().includes(searchQuery.toLowerCase())

            return (
              <div key={msg.id} className={cn(isDimmed && 'opacity-40')}>
                <MessageItem
                  message={msg}
                  isOwn={msg.user_id === currentUserId}
                  isGroupStart={isGroupStart}
                  isAdmin={isAdmin}
                  isBlocked={blockedUserIds.includes(msg.user_id)}
                  isConfessionBox={isConfessionBox}
                  currentUserId={currentUserId}
                  searchQuery={searchQuery}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPin={onPin}
                  onReport={onReport}
                  onBlock={onBlock}
                  onJumpToMessage={onJumpToMessage}
                />
              </div>
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
