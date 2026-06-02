'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import {
  Reply,
  Bookmark,
  Flag,
  Pencil,
  Trash2,
  Pin,
  Ban,
} from 'lucide-react'

const REACTIONS = ['👍', '❤️', '😂', '🔥', '😮']

interface ReactionBarProps {
  messageId: string
  userId: string
  isOwn: boolean
  canEdit: boolean
  isAdmin: boolean
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onPin: () => void
  onReport: () => void
  onBlock: () => void
  onBookmark: () => void
}

export default function ReactionBar({
  messageId,
  userId,
  isOwn,
  canEdit,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReport,
  onBlock,
  onBookmark,
}: ReactionBarProps) {
  const [optimisticReactions, setOptimisticReactions] = useState<Set<string>>(new Set())
  const supabase = createClient()

  async function handleReaction(emoji: string) {
    // Optimistic update
    const key = `${messageId}-${emoji}`
    if (optimisticReactions.has(key)) {
      setOptimisticReactions((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      // Remove reaction
      await supabase
        .from('reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
    } else {
      setOptimisticReactions((prev) => {
        const next = new Set(prev)
        next.add(key)
        return next
      })
      // Add reaction
      await supabase
        .from('reactions')
        .insert({ message_id: messageId, user_id: userId, emoji })
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      {/* Reaction buttons */}
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md text-sm transition-all hover:bg-sidebar-hover hover:scale-110',
            optimisticReactions.has(`${messageId}-${emoji}`) && 'bg-primary/10 scale-110'
          )}
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}

      <div className="w-px h-5 bg-border mx-1" />

      {/* Action buttons */}
      <button
        onClick={onReply}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-hover transition-colors"
        title="Reply"
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onBookmark}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-hover transition-colors"
        title="Bookmark"
      >
        <Bookmark className="h-3.5 w-3.5" />
      </button>

      {canEdit && (
        <button
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-hover transition-colors"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {(isOwn || isAdmin) && (
        <button
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-md text-destructive/70 hover:bg-destructive/10 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {isAdmin && (
        <button
          onClick={onPin}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-hover transition-colors"
          title="Pin"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        onClick={onReport}
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-hover transition-colors"
        title="Report"
      >
        <Flag className="h-3.5 w-3.5" />
      </button>

      {!isOwn && (
        <button
          onClick={onBlock}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-hover transition-colors"
          title="Block user"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
