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
  currentUserId: string
  isAdmin: boolean
  isConfessionBox: boolean
  accentColor: string
  blockedUserIds: string[]
  onReply: (messageId: string) => void
  onEdit: (messageId: string) => void
  onDelete: (messageId: string) => void
  onPin: (messageId: string) => void
  onReport: (messageId: string) => void
  onBlock: (userId: string) => void
  onBookmark: (messageId: string) => void
  onJumpToMessage: (messageId: string) => void
}

export default function MessageList({
  roomId,
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
  const [messages, setMessages] = useState<any[]>([])
  const [polls, setPolls] = useState<Tables<'polls'>[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isScrolledUpRef = useRef(false)
  const supabase = createClient()

  useEffect(() => {
    loadMessages()
    loadPolls()
    subscribeToMessages()
    subscribeToTyping()

    return () => {
      supabase.removeAllChannels()
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

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        profiles!inner(anonymous_name, avatar_color),
        reactions(
          id, emoji, user_id,
          profiles!inner(anonymous_name)
        ),
        reply_to_message:messages!messages_reply_to_fkey(
          content,
          profiles!inner(anonymous_name)
        )
      `)
      .eq('room_id', roomId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(100)

    if (data) setMessages(data)
    setIsLoading(false)
  }

  async function loadPolls() {
    const { data } = await supabase
      .from('polls')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })

    if (data) setPolls(data)
  }

  function subscribeToMessages() {
    const channel = supabase
      .channel(`messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              profiles!inner(anonymous_name, avatar_color),
              reactions(
                id, emoji, user_id,
                profiles!inner(anonymous_name)
              ),
              reply_to_message:messages!messages_reply_to_fkey(
                content,
                profiles!inner(anonymous_name)
              )
            `)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages((prev) => [...prev, data])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, ...payload.new } : m
            )
          )
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .subscribe()
  }

  function subscribeToTyping() {
    const channel = supabase.channel(`room:${roomId}`, {
      config: {
        presence: {
          key: 'typing-status',
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const typing: string[] = []
        for (const key in state) {
          const presences = state[key] as any[]
          if (presences?.length > 0 && presences[0].typing && presences[0].user !== currentUserId) {
            typing.push(presences[0].user)
          }
        }
        setTypingUsers(typing)
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setHasNewMessages(false)
  }

  const groupedMessages = messages.reduce((groups: any[], msg, index) => {
    const prevMsg = index > 0 ? messages[index - 1] : null
    const isGroupStart =
      !prevMsg ||
      prevMsg.user_id !== msg.user_id ||
      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000

    groups.push({ message: msg, isGroupStart })
    return groups
  }, [])

  if (isLoading) {
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
            <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-accent-gradient shadow-lg shadow-purple-500/20 mb-4">
              <span className="text-2xl">👻</span>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No messages yet</h3>
            <p className="text-sm text-[#56566E] max-w-xs">
              Be the first to send a message in this room
            </p>
          </div>
        )}

        {/* Confession box notice */}
        {isConfessionBox && (
          <div className="px-4 py-3 bg-orange-500/5 border-b border-orange-500/10">
            <p className="text-xs text-orange-400 text-center">
              🔥 This room has no memory. Messages auto-delete after 1 hour.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="py-2">
          {groupedMessages.map(({ message, isGroupStart }) => (
            <MessageItem
              key={message.id}
              message={message}
              isOwn={message.user_id === currentUserId}
              isGroupStart={isGroupStart}
              isAdmin={isAdmin}
              isBlocked={blockedUserIds.includes(message.user_id)}
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
          ))}

          {/* Polls */}
          {polls.map((poll) => (
            <div key={poll.id} className="px-4 py-2">
              <PollCard
                poll={poll}
                isAdmin={isAdmin}
                currentUserId={currentUserId}
              />
            </div>
          ))}
        </div>

        {/* Typing indicator */}
        <TypingIndicator users={typingUsers} />

        <div ref={bottomRef} />
      </div>

      {/* New messages button */}
      {hasNewMessages && (
        <Button
          onClick={scrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-xl animate-slide-up bg-[#13131F] border border-[#22223A] text-white hover:bg-[#1A1530]"
          size="sm"
        >
          <ArrowDown className="h-4 w-4 mr-1" />
          New messages
        </Button>
      )}
    </div>
  )
}
