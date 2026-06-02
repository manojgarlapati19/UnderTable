'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils/cn'
import { getRelativeTime, getFullTimestamp } from '@/lib/utils/time'
import { getAvatarColor, getAvatarGradient } from '@/lib/utils/avatar-color'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ReactionBar from './ReactionBar'
import ReactionPill from './ReactionPill'
import ReadReceipts from './ReadReceipts'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Tables } from '@/lib/supabase/database.types'

interface MessageItemProps {
  message: Tables<'messages'> & {
    profiles?: { anonymous_name: string; avatar_color: string }
    reactions?: Array<{ id: string; emoji: string; user_id: string; profiles?: { anonymous_name: string } }>
    reply_to_message?: Tables<'messages'> & { profiles?: { anonymous_name: string } }
  }
  isOwn: boolean
  isGroupStart: boolean
  isAdmin: boolean
  isBlocked: boolean
  isConfessionBox: boolean
  currentUserId: string
  onReply: (messageId: string) => void
  onEdit: (messageId: string) => void
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
  const editRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  const [timeAgo, setTimeAgo] = useState(() => getRelativeTime(message.created_at))
  const isDeleted = message.is_deleted
  const avatarGradient = message.profiles?.anonymous_name
    ? getAvatarGradient(message.profiles.anonymous_name)
    : 'linear-gradient(135deg, #7C3AED, #9333EA)'
  const avatarColor = message.profiles?.avatar_color || getAvatarColor(message.profiles?.anonymous_name || 'Unknown')

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
    }
    setIsEditing(false)
  }

  function handleCancelEdit() {
    setEditContent(message.content)
    setIsEditing(false)
  }

  const reactionGroups = message.reactions?.reduce<Record<string, { count: number; hasReacted: boolean; names: string[] }>>((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, hasReacted: false, names: [] }
    }
    acc[r.emoji].count++
    if (r.user_id === currentUserId) acc[r.emoji].hasReacted = true
    if (r.profiles?.anonymous_name) acc[r.emoji].names.push(r.profiles.anonymous_name)
    return acc
  }, {}) || {}

  const canEdit = isOwn && !isDeleted && (Date.now() - new Date(message.created_at).getTime() < 10 * 60 * 1000)

  if (isDeleted) {
    return (
      <div ref={messageRef} id={`msg-${message.id}`} className="px-4 py-1">
        <div className="flex items-center gap-2 py-1">
          <div className="w-8" />
          <p className="text-sm italic text-[#56566E]">this message was removed</p>
        </div>
      </div>
    )
  }

  if (isBlocked) {
    return (
      <div ref={messageRef} id={`msg-${message.id}`} className="px-4 py-1">
        <div className="flex items-center gap-2 py-1">
          <div className="w-8" />
          <p className="text-sm italic text-[#56566E]">message hidden</p>
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
        isOwn ? 'hover:bg-transparent' : 'hover:bg-[#0B0B14]/50'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Reply context */}
      {message.reply_to_message && (
        <div className={cn('flex items-center gap-2 mb-1', isOwn ? 'justify-end mr-10' : 'ml-10')}>
          <div className="w-1 h-4 rounded-full shrink-0 bg-accent" />
          <button
            onClick={() => onJumpToMessage(message.reply_to!)}
            className="text-xs text-[#56566E] hover:text-accent transition-colors duration-150 truncate"
          >
            <span className="font-medium">{message.reply_to_message.profiles?.anonymous_name || 'Unknown'}</span>
            : {message.reply_to_message.content}
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
              {message.profiles?.anonymous_name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-8 shrink-0" />
        )}

        <div className={cn('flex-1 min-w-0 max-w-[75%]', isOwn ? 'flex flex-col items-end' : '')}>
          {/* Header */}
          {isGroupStart && !isOwn && (
            <div className="flex items-center gap-2 mb-0.5 px-1">
              <span className="text-sm font-medium text-[#A29BD4]">
                {message.profiles?.anonymous_name || 'Unknown'}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-[#56566E] cursor-default">
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
              <input
                ref={editRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit()
                  if (e.key === 'Escape') handleCancelEdit()
                }}
                className="flex-1 rounded-[12px] border border-accent bg-[#13131F] px-3 py-1.5 text-sm text-white outline-none"
              />
              <button onClick={handleSaveEdit} className="text-xs text-accent font-medium hover:underline">
                Save
              </button>
              <button onClick={handleCancelEdit} className="text-xs text-[#56566E] hover:underline">
                Cancel
              </button>
            </div>
          ) : (
            <div
              className={cn(
                'rounded-[16px] px-3.5 py-2 leading-relaxed whitespace-pre-wrap break-words animate-slide-up',
                isOwn
                  ? 'bg-accent-gradient text-white rounded-br-[5px]'
                  : 'bg-[#16162A] text-white rounded-tl-[5px]'
              )}
            >
              <p className="text-sm">
                {message.content}
                {message.is_edited && (
                  <span className="text-[10px] text-white/50 ml-1">(edited)</span>
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
                  onToggle={() => {}}
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
        <div className={cn(
          'absolute -top-4 z-10 animate-fade-in',
          isOwn ? 'right-4' : 'left-16'
        )}>
          <div className="rounded-[12px] border border-[#22223A] bg-[#13131F] shadow-xl px-1 py-0.5 backdrop-blur-xl">
            <ReactionBar
              messageId={message.id}
              userId={currentUserId}
              isOwn={isOwn}
              canEdit={canEdit}
              isAdmin={isAdmin}
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
