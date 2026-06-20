'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
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
// `Tables` was previously imported for the message-shape interface but we
// now type the message prop explicitly (see interface below). The type
// alias is intentionally avoided to keep the contract narrow and to make
// cross-component shape mismatches visible at the boundary.

interface MessageItemProps {
  // The Message shape produced by useMessages.ts (flat fields), not a
  // Supabase join. The previous version expected `message.profile?.anonymous_name`
  // and `message.reply_message.content` — fields that don't exist on the
  // shape returned by `useMessages`, so every message rendered as
  // "Unknown" sender with no reply context. See useMessages.ts for the
  // canonical shape.
  message: {
    id: string
    content: string
    user_id: string
    created_at: string
    is_edited: boolean
    is_deleted: boolean
    sender_name: string
    sender_color: string
    reply_to: string | null
    reply_preview: {
      id: string
      content: string
      sender_name: string
      sender_color: string
    } | null
    reactions: Array<{ id: string; emoji: string; user_id: string }>
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

  // FIX: read flat sender_name/sender_color from the Message shape produced by
  // useMessages. The previous code read `message.profile?.anonymous_name`
  // which was always undefined, making every message render as "Unknown".
  const senderName = message.sender_name || 'Unknown'
  const avatarGradient = senderName
    ? getAvatarGradient(senderName)
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

  // FIX: previously `createClient()` was called in the render body, which
  // created a fresh Supabase client (and its internal listeners) on every
  // re-render. Hoist it into a ref so a single client is reused for the
  // lifetime of the component.
  const supabase = useRef(createClient()).current

  // FIX: `userReactedEmojis` was a fresh Set on every render, which made
  // `useCallback([...userReactedEmojis, ...])` recreate the callback on every
  // render — defeating memoisation and (more subtly) capturing a stale Set
  // when two rapid clicks fired in the same tick. Memoise the Set on the
  // underlying reactions array so the reference is stable until reactions
  // actually change, and snapshot it into a ref so the click handler always
  // reads the latest value without depending on the Set directly.
  const userReactedEmojis = useMemo(
    () =>
      new Set(
        message.reactions
          ?.filter((r) => r.user_id === currentUserId)
          .map((r) => r.emoji) || []
      ),
    [message.reactions, currentUserId]
  )
  const userReactedEmojisRef = useRef(userReactedEmojis)
  userReactedEmojisRef.current = userReactedEmojis

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

  const handleReactionToggle = useCallback(
    async (emoji: string) => {
      // Always read the latest Set via ref to avoid stale-closure toggles on
      // rapid clicks. See the comment above for the rationale.
      const hasReacted = userReactedEmojisRef.current.has(emoji)
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
          // 23505 = unique violation (already reacted); 23514 = check
          // constraint (emoji not in the allowed 5). Silently no-op for
          // both — the optimistic UI is the source of truth and the
          // realtime subscription will reconcile.
          if (error && error.code !== '23505' && error.code !== '23514') {
            throw error
          }
        }
      } catch {
        toast.error('Failed to update reaction')
      }
    },
    [message.id, currentUserId, supabase]
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
      {/* Reply context — read from the flat reply_preview shape produced by
          useMessages. The previous version read `message.reply_message.content`
          and `message.reply_message.profile?.anonymous_name`, both of which
          were always undefined, so the reply preview never rendered. */}
      {message.reply_preview && (
        <div className={cn('flex items-center gap-2 mb-1', isOwn ? 'justify-end mr-10' : 'ml-10')}>
          <div className="w-1 h-4 rounded-full shrink-0 bg-[#A78BFA]" />
          <button
            onClick={() => message.reply_to && onJumpToMessage(message.reply_to)}
            className="text-xs text-[rgba(255,255,255,0.45)] hover:text-[#A78BFA] transition-colors duration-150 truncate"
          >
            <span className="font-medium">
              {message.reply_preview.sender_name || 'Unknown'}
            </span>
            :{' '}
            {isGifUrl(message.reply_preview.content) ? (
              <span className="italic">GIF</span>
            ) : (
              message.reply_preview.content
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
