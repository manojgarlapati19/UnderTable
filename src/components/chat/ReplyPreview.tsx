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
    <div className="flex items-center gap-2 border-l-[3px] border-accent bg-[#1A1530]/50 px-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#C4B5FD]">Replying to {senderName}</p>
        <p className="text-xs text-[#8888A0] truncate">{content}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-[8px]" onClick={onDismiss}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
