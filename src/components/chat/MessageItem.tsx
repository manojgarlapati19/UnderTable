'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { getRelativeTime, getFullTimestamp } from '@/lib/utils/time'
import { getAvatarGradient } from '@/lib/utils/avatar-color'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import ReactionBar from './ReactionBar'
import ReactionPill from './ReactionPill'
import ReadReceipts from './ReadReceipts'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
  searchQuery?: string
  onReply: (messageId: string) => void
  onEdit: (messageId: string, content: string) => void
  onDelete: (messageId: string) => void
  onPin: (messageId: string) => void
  onReport: (messageId: string) => void
  onBlock: (userId: string) => void
  onJumpToMessage: (messageId: string) => void
}

function highlightSearchText(text: string, searchQuery?: string): (string | React.ReactNode)[] {
  if (!searchQuery) return highlightMentions(text)
  const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return parts.map((part, i) => {
    if (part.toLowerCase() === searchQuery.toLowerCase()) {
      return <mark key={i} className="bg-[#A78BFA]/30 text-white rounded px-0.5">{part}</mark>
    }
    // Also apply mention highlighting within non-matching parts
    return highlightMentions(part)
  })
}

function highlightMentions(text: string): (string | React.ReactNode)[] {
  const parts = text.split(/(@\w+\s\w+|@\w+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span
          key={i}
          className="bg-[rgba(167,139,250,0.25)] text-[#C4B5FD] rounded px-1"
        >
          {part}
        </span>
      )
    }
    return part
  })
}

// Detect GIF image URLs. Returns true if the content is a single URL pointing
// to a GIF (tenor share URL, giphy share URL, or direct .gif/.webp link).
const DIRECT_GIF_RE = /^https?:\/\/\S+\.(gif|webp)(\?\S*)?$/i
const GIF_HOST_RE =
  /^(https?:\/\/)?(media1\.)?(media\.tenor\.com|tenor\.com|giphy\.com|media\.giphy\.com|i\.giphy\.com|c\.tenor\.com|media\.tenor\.co)/i
const TENOR_SHARE_RE = /^https?:\/\/(www\.)?tenor\.com\/view\//i

export function isGifUrl(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  // Tenor share pages embed the actual gif via a meta tag — show a clickable
  // link to the share page rather than rendering a broken image.
  if (TENOR_SHARE_RE.test(trimmed)) return true
  if (DIRECT_GIF_RE.test(trimmed)) return true
  if (GIF_HOST_RE.test(trimmed) && /\.(gif|webp)(\?|$)/i.test(trimmed)) return true
  return false
}

export function getGifSrc(text: string): string {
  return text.trim()
}

function GifImage({ url, alt = 'GIF' }: { url: string; alt?: string }) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  if (errored) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-[#A78BFA] underline hover:text-[#C4B5FD]"
      >
        {url}
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block max-w-[320px] sm:max-w-[400px] overflow-hidden rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.2)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
        className={cn(
          'block w-full h-auto max-h-[400px] object-contain transition-opacity duration-200',
          loaded ? 'opacity-100' : 'opacity-0'
        )}
        style={{ display: loaded ? 'block' : 'none' }}
      />
      {!loaded && (
        <div className="flex items-center justify-center h-40 text-xs text-[rgba(255,255,255,0.45)]">
          Loading GIF…
        </div>
      )}
    </a>
  )
}

function renderMessageBody(
  content: string,
  searchQuery: string | undefined,
  isEdited: boolean
) {
  if (isGifUrl(content)) {
    return (
      <div className="space-y-1">
        <GifImage url={getGifSrc(content)} alt="Shared GIF" />
        {isEdited && (
          <span className="block text-[10px] text-[rgba(255,255,255,0.5)]">(edited)</span>
        )}
      </div>
    )
  }
  return (
    <p style={{ fontSize: '14px' }}>
      {highlightSearchText(content, searchQuery)}
      {isEdited && (
        <span className="text-[10px] text-[rgba(255,255,255,0.5)] ml-1">(edited)</span>
      )}
    </p>
  )
}

export default function MessageItem({
  message,
  isOwn,
  isGroupStart,
  isAdmin,
  isBlocked,
  isConfessionBox,
  currentUserId,
  searchQuery,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReport,
  onBlock,
  onJumpToMessage,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false)
  const [showBelow, setShowBelow] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showBlockConfirm, setShowBlockConfirm] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const messageRef = useRef<HTMLDivElement>(null)
  const [timeAgo, setTimeAgo] = useState(() => getRelativeTime(message.created_at))
  const isDeleted = message.is_deleted

  const senderName = message.profile?.anonymous_name || 'Unknown'
  const avatarGradient = message.profile?.anonymous_name
    ? getAvatarGradient(message.profile.anonymous_name)
    : 'linear-gradient(135deg, #7C3AED, #9333EA)'
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

  useEffect(() => {
    if (showActions && messageRef.current) {
      const rect = messageRef.current.getBoundingClientRect()
      setShowBelow(rect.top < 80)
    }
  }, [showActions])

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

  function handleBlockClick() {
    setShowBlockConfirm(true)
  }

  function handleBlockConfirm() {
    onBlock(message.user_id)
    setShowBlockConfirm(false)
    toast.success('User blocked. Their messages are now hidden.')
  }

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

  const isGif = isGifUrl(message.content)

  return (
    <div
      ref={messageRef}
      id={`msg-${message.id}`}
      className={cn(
        'group relative px-4 py-0.5 transition-all duration-150',
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Reply context */}
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
            :{' '}
            {isGifUrl(message.reply_message.content) ? (
              <span className="italic">GIF</span>
            ) : (
              message.reply_message.content
            )}
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
              <span className="text-sm font-semibold text-[#C4B5FD]">{senderName}</span>
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
              style={{
                borderRadius: '16px',
                padding: isGif ? '4px' : '10px 14px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                animation: 'slide-up 0.2s ease-out',
                ...(isOwn
                  ? {
                      background: isGif
                        ? 'transparent'
                        : 'linear-gradient(135deg, #7C3AED, #9333EA)',
                      color: 'white',
                      borderTopRightRadius: '4px',
                      boxShadow: isGif ? 'none' : '0 3px 12px rgba(124,58,237,0.3)',
                    }
                  : {
                      background: isGif ? 'transparent' : 'rgba(255,255,255,0.07)',
                      border: isGif ? 'none' : '1px solid rgba(255,255,255,0.07)',
                      color: '#EDEBF7',
                      borderTopLeftRadius: '4px',
                    }),
              }}
            >
              {renderMessageBody(message.content, searchQuery, message.is_edited)}
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
          className={cn(
            'absolute z-50 animate-fade-in',
            showBelow ? 'top-full mt-1' : '-top-9',
            isOwn ? 'right-4' : 'left-16'
          )}
        >
          <div className="rounded-[13px] border border-[rgba(255,255,255,0.2)] bg-[rgba(15,10,40,0.92)] shadow-xl px-1 py-0.5 backdrop-blur-[20px] flex items-center">
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
              onBlock={handleBlockClick}
            />
          </div>
        </div>
      )}

      {/* Block confirmation dialog */}
      <Dialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block User</DialogTitle>
            <DialogDescription>
              Hide all messages from this person? Only you will see this.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowBlockConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBlockConfirm}>
              Block User
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
