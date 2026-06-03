'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { getRelativeTime, getFullTimestamp } from '@/lib/utils/time'
import { getAvatarColor, getAvatarGradient } from '@/lib/utils/avatar-color'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ReactionBar from './ReactionBar'
import ReactionPill from './ReactionPill'
import ReadReceipts from './ReadReceipts'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Tables } from '@/lib/supabase/database.types'

interface MessageItemProps {
  message: Tables<'messages'> & {
    profile?: { anonymous_name: string; avatar_color: string } | null
    reactions?: Array<{ id: string; emoji: string; user_id: string }>
    reply_message?: {
      content: string
      profile?: { anonymous_name: string } | null
    } | null
  }
  isOwn: boolean
  isGroupStart: boolean
  isAdmin: boolean
  isBlocked: boolean
  isConfessionBox: boolean
  currentUserId: string
  onReply: (messageId: string) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onPin: (messageId: string) => void
  onReport: (messageId: string) => void
  onBlock: (userId: string) => void
  onBookmark: (messageId: string) => void
  onJumpToMessage: (messageId: string) => void
}

export default function MessageItem({
  message,
  isOwn,
  isGroupStart,
  isAdmin,
  isBlocked,
  isConfessionBox,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReport,
  onBlock,
  onBookmark,
  onJumpToMessage,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  const [timeAgo, setTimeAgo] = useState(() => getRelativeTime(message.created_at))
  const isDeleted = message.is_deleted

  // Use profile (new field name from fixed hook)
  const senderName = message.profile?.anonymous_name || 'Unknown'
  const avatarGradient = message.profile?.anonymous_name
    ? getAvatarGradient(message.profile.anonymous_name)
    : 'linear-gradient(135deg, #7C3AED, #9333EA)'
  const avatarColor = message.profile?.avatar_color || getAvatarColor(senderName)

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(getRelativeTime(message.created_at))
    }, 30000)
    return () => clearInterval(interval)
  }, [message.created_at])

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus()
      editRef.current.setSelectionRange(editContent.length, editContent.length)
    }
  }, [isEditing])

  useEffect(() => {
    if (messageRef.current && window.location.hash === `#msg-${message.id}`) {
      messageRef.current.classList.add('message-highlight')
    }
  }, [message.id])

  function handleSaveEdit() {
    if (editContent.trim() && editContent !== message.content) {
      onEdit(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  function handleCancelEdit() {
    setEditContent(message.content)
    setIsEditing(false)
  }

  const supabase = createClient()

  const reactionGroups = message.reactions?.reduce<
    Record<string, { count: number; hasReacted: boolean; names: string[] }>
  >((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, hasReacted: false, names: [] }
    }
    acc[r.emoji].count++
    if (r.user_id === currentUserId) acc[r.emoji].hasReacted = true
    return acc
  }, {}) || {}

  const userReactedEmojis = new Set(
    message.reactions?.filter((r) => r.user_id === currentUserId).map((r) => r.emoji) || []
  )

  const handleReactionToggle = useCallback(
    async (emoji: string) => {
      const hasReacted = userReactedEmojis.has(emoji)
      try {
        if (hasReacted) {
          await supabase
            .from('reactions')
            .delete()
            .eq('message_id', message.id)
            .eq('user_id', currentUserId)
            .eq('emoji', emoji)
        } else {
          const { error } = await supabase.from('reactions').insert({
            message_id: message.id,
            user_id: currentUserId,
            emoji,
          })
          if (error && error.code !== '23505') throw error
        }
      } catch {
        toast.error('Failed to update reaction')
      }
    },
    [message.id, currentUserId, userReactedEmojis, supabase]
  )

  const canEdit =
    isOwn &&
    !isDeleted &&
    Date.now() - new Date(message.created_at).getTime() < 10 * 60 * 1000

  if (isDeleted) {
    return (
      <div ref={messageRef} id={`msg-${message.id}`} className="px-4 py-1">
        <div className="flex items-center gap-2 py-1">
          <div className="w-8" />
          <p className="text-sm italic text-[rgba(255,255,255,0.45)]">this message was removed</p>
        </div>
      </div>
    )
  }

  if (isBlocked) {
    return (
      <div ref={messageRef} id={`msg-${message.id}`} className="px-4 py-1">
        <div className="flex items-center gap-2 py-1">
          <div className="w-8" />
          <p className="text-sm italic text-[rgba(255,255,255,0.45)]">message hidden</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={messageRef}
      id={`msg-${message.id}`}
      className={cn(
        'group relative px-4 py-0.5 transition-colors duration-150',
        isOwn ? 'hover:bg-transparent' : 'hover:bg-[rgba(255,255,255,0.02)]'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Reply context — uses reply_message (new field name) */}
      {message.reply_message && (
        <div className={cn('flex items-center gap-2 mb-1', isOwn ? 'justify-end mr-10' : 'ml-10')}>
          <div className="w-1 h-4 rounded-full shrink-0 bg-[#A78BFA]" />
          <button
            onClick={() => message.reply_to && onJumpToMessage(message.reply_to)}
            className="text-xs text-[rgba(255,255,255,0.45)] hover:text-[#A78BFA] transition-colors duration-150 truncate"
          >
            <span className="font-medium">
              {message.reply_message.profile?.anonymous_name || 'Unknown'}
            </span>
            : {message.reply_message.content}
          </button>
        </div>
      )}

      <div className={cn('flex gap-2.5', isOwn ? 'flex-row-reverse' : '', isGroupStart ? 'mt-3' : '')}>
        {/* Avatar */}
        {isGroupStart && !isOwn ? (
          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
            <AvatarFallback
              style={{ background: avatarGradient }}
              className="text-white text-xs"
            >
              {senderName.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-8 shrink-0" />
        )}

        <div className={cn('flex-1 min-w-0 max-w-[75%]', isOwn ? 'flex flex-col items-end' : '')}>
          {/* Header */}
          {isGroupStart && !isOwn && (
            <div className="flex items-center gap-2 mb-0.5 px-1">
              <span className="text-sm font-medium text-[#C4B5FD]">{senderName}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-[rgba(255,255,255,0.45)] cursor-default">
                      {timeAgo}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{getFullTimestamp(message.created_at)}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Message bubble */}
          {isEditing ? (
            <div className="flex items-center gap-2 w-full">
              <textarea
                ref={editRef}
                value={editContent}
                rows={1}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSaveEdit()
                  }
                  if (e.key === 'Escape') handleCancelEdit()
                }}
                className="flex-1 rounded-[12px] border border-accent bg-[#13131F] px-3 py-1.5 text-sm text-white outline-none resize-none"
              />
              <button
                onClick={handleSaveEdit}
                className="text-xs text-accent font-medium hover:underline"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-xs text-[#56566E] hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div
              className={cn(
                'rounded-[17px] px-3.5 py-2 leading-relaxed whitespace-pre-wrap break-words animate-slide-up',
                isOwn
                  ? 'bg-primary-gradient text-[#2E1065] rounded-br-[5px]'
                  : 'glass-message text-white rounded-tl-[5px]'
              )}
            >
              <p className="text-sm">
                {message.content}
                {message.is_edited && (
                  <span className="text-[10px] text-[rgba(255,255,255,0.5)] ml-1">(edited)</span>
                )}
              </p>
            </div>
          )}

          {/* Reactions */}
          {!isConfessionBox && !isEditing && Object.keys(reactionGroups).length > 0 && (
            <div className={cn('flex flex-wrap gap-1 mt-1', isOwn ? 'justify-end' : '')}>
              {Object.entries(reactionGroups).map(([emoji, { count, hasReacted, names }]) => (
                <ReactionPill
                  key={emoji}
                  emoji={emoji}
                  count={count}
                  hasReacted={hasReacted}
                  reactorNames={names}
                  onToggle={() => handleReactionToggle(emoji)}
                />
              ))}
            </div>
          )}

          {/* Read receipts */}
          {!isConfessionBox && !isOwn && (
            <ReadReceipts messageId={message.id} maxVisible={5} />
          )}
        </div>
      </div>

      {/* Floating action bar */}
      {showActions && !isEditing && (
        <div
          className={cn('absolute -top-4 z-10 animate-fade-in', isOwn ? 'right-4' : 'left-16')}
        >
          <div className="rounded-[13px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] shadow-xl px-1 py-0.5 backdrop-blur-[20px]">
            <ReactionBar
              messageId={message.id}
              userId={currentUserId}
              userReactedEmojis={userReactedEmojis}
              isOwn={isOwn}
              canEdit={canEdit}
              isAdmin={isAdmin}
              onReact={handleReactionToggle}
              onReply={() => onReply(message.id)}
              onEdit={() => setIsEditing(true)}
              onDelete={() => onDelete(message.id)}
              onPin={() => onPin(message.id)}
              onReport={() => onReport(message.id)}
              onBlock={() => onBlock(message.user_id)}
              onBookmark={() => onBookmark(message.id)}
            />
          </div>
        </div>
      )}
    </div>
  )
}