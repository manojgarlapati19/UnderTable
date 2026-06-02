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
    <div className="flex items-center gap-2 border-l-2 border-primary bg-primary/5 px-4 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">Replying to {senderName}</p>
        <p className="text-xs text-muted-foreground truncate">{content}</p>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onDismiss}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
