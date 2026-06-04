'use client'

import { cn } from '@/lib/utils/cn'
import {
  Reply,
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
  userReactedEmojis: Set<string>
  isOwn: boolean
  canEdit: boolean
  isAdmin: boolean
  onReact: (emoji: string) => void
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onPin: () => void
  onReport: () => void
  onBlock: () => void
}

export default function ReactionBar({
  messageId,
  userId,
  userReactedEmojis,
  isOwn,
  canEdit,
  isAdmin,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onReport,
  onBlock,
}: ReactionBarProps) {
  return (
    <div className="flex items-center gap-0.5">
      {REACTIONS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-[8px] text-base transition-all duration-150 hover:bg-[rgba(255,255,255,0.12)] hover:scale-110',
            userReactedEmojis.has(emoji) && 'bg-[rgba(255,255,255,0.1)] scale-110'
          )}
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}

      <div className="w-px h-5 bg-[rgba(255,255,255,0.15)] mx-1" />

      <button
        onClick={onReply}
        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150"
        title="Reply"
      >
        <Reply className="h-3.5 w-3.5" />
      </button>

      {canEdit && (
        <button
          onClick={onEdit}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}

      {(isOwn || isAdmin) && (
        <button
          onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {isAdmin && (
        <button
          onClick={onPin}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150"
          title="Pin"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        onClick={onReport}
        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150"
        title="Report"
      >
        <Flag className="h-3.5 w-3.5" />
      </button>

      {!isOwn && (
        <button
          onClick={onBlock}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.12)] hover:text-white transition-all duration-150"
          title="Block user"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
