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
    const key = `${messageId}-${emoji}`
    if (optimisticReactions.has(key)) {
      setOptimisticReactions((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
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
      await supabase
        .from('reactions')
        .insert({ message_id: messageId, user_id: userId, emoji })
    }
  }

  return (
    <div className="flex items-center gap-0.5">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReaction(emoji)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-[8px] text-sm transition-all duration-150 hover:bg-[#1A1530] hover:scale-110',
            optimisticReactions.has(`${messageId}-${emoji}`) && 'bg-[#1A1530] scale-110'
          )}
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}

      <div className="w-px h-5 bg-[#22223A] mx-1" />

      <button
        onClick={onReply}
        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#56566E] hover:bg-[#1A1530] hover:text-white transition-all duration-150"
        title="Reply"
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onBookmark}
        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#56566E] hover:bg-[#1A1530] hover:text-white transition-all duration-150"
        title="Bookmark"
      >
        <Bookmark className="h-3.5 w-3.5" />
      </button>

      {canEdit && (
        <button
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#56566E] hover:bg-[#1A1530] hover:text-white transition-all duration-150"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {(isOwn || isAdmin) && (
        <button
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {isAdmin && (
        <button
          onClick={onPin}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#56566E] hover:bg-[#1A1530] hover:text-white transition-all duration-150"
          title="Pin"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        onClick={onReport}
        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#56566E] hover:bg-[#1A1530] hover:text-white transition-all duration-150"
        title="Report"
      >
        <Flag className="h-3.5 w-3.5" />
      </button>

      {!isOwn && (
        <button
          onClick={onBlock}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#56566E] hover:bg-[#1A1530] hover:text-white transition-all duration-150"
          title="Block user"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
