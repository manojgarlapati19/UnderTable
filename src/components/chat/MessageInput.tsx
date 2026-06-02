'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Smile, Image, Send, X, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import ReplyPreview from './ReplyPreview'

interface MessageInputProps {
  roomId: string
  roomName: string
  profileName: string
  isReadonly: boolean
  slowModeSeconds: number
  isConfessionBox: boolean
  onSend: (content: string, replyTo?: string | null) => Promise<void>
  onOpenPoll: () => void
  onOpenGif: () => void
  replyTo: { id: string; content: string; senderName: string } | null
  onDismissReply: () => void
  onTypingChange?: (typing: boolean) => void
}

export default function MessageInput({
  roomId,
  roomName,
  profileName,
  isReadonly,
  slowModeSeconds,
  isConfessionBox,
  onSend,
  onOpenPoll,
  onOpenGif,
  replyTo,
  onDismissReply,
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [slowModeTimer, setSlowModeTimer] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  // Slow mode timer
  useEffect(() => {
    if (slowModeTimer > 0) {
      const interval = setInterval(() => {
        setSlowModeTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [slowModeTimer])

  // Emit typing presence via callback
  const emitTyping = useCallback(() => {
    onTypingChange?.(true)
  }, [onTypingChange])

  const handleInput = useCallback(() => {
    emitTyping()
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      onTypingChange?.(false)
    }, 3000)
  }, [emitTyping, onTypingChange])

  async function handleSend() {
    const trimmed = content.trim()
    if (!trimmed || isSending || slowModeTimer > 0) return

    setIsSending(true)
    try {
      await onSend(trimmed, replyTo?.id || null)
      setContent('')
      onDismissReply()

      // Start slow mode countdown
      if (slowModeSeconds > 0) {
        setSlowModeTimer(slowModeSeconds)
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      onDismissReply()
    }
  }

  function insertEmoji(emoji: string) {
    setContent((prev) => prev + emoji)
    setShowEmojiPicker(false)
    textareaRef.current?.focus()
  }

  if (isReadonly) {
    return (
      <div className="border-t border-border p-4">
        <div className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
          UnderTable is currently in read-only mode. Check back soon!
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-border">
      {/* Reply preview */}
      {replyTo && (
        <ReplyPreview
          senderName={replyTo.senderName}
          content={replyTo.content}
          onDismiss={onDismissReply}
        />
      )}

      {/* Slow mode indicator */}
      {slowModeTimer > 0 && (
        <div className="px-4 py-1.5 text-xs text-muted-foreground text-center bg-muted">
          You can send again in {slowModeTimer}s
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Action buttons */}
        <div className="flex items-center gap-1 pb-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Add emoji"
          >
            <Smile className="h-4 w-4" />
          </Button>
          {!isConfessionBox && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={onOpenGif}
                title="Add GIF"
              >
                <Image className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={onOpenPoll}
                title="Create poll"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              handleInput()
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message as ${profileName}...`}
            disabled={slowModeTimer > 0}
            className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 placeholder:text-muted-foreground"
            rows={1}
          />
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!content.trim() || isSending || slowModeTimer > 0}
          size="icon"
          className="h-9 w-9 rounded-full shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Emoji picker popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 z-50">
          <div className="rounded-lg border border-border bg-background shadow-lg p-2">
            <div className="grid grid-cols-8 gap-1">
              {['👍', '❤️', '😂', '🔥', '😮', '🎉', '🙏', '💯',
                '✨', '🚀', '👀', '💪', '🤔', '😅', '🥳', '👏',
                '🙌', '💜', '⭐', '🌈', '🦄', '🍕', '🎸', '🌟'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-sidebar-hover transition-colors text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
