'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReplyPreviewProps {
  senderName: string
  content: string
  onDismiss: () => void
}

export default function ReplyPreview({ senderName, content, onDismiss }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 border-l-[3px] border-[#A78BFA] bg-[rgba(255,255,255,0.05)] px-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#C4B5FD]">Replying to {senderName}</p>
        <p className="text-xs text-[rgba(255,255,255,0.7)] truncate">{content}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-[8px]" onClick={onDismiss}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
