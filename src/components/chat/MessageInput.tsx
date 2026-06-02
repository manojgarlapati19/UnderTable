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

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

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
      <div className="border-t border-[#18182A] p-4 bg-[#0E0E1A]">
        <div className="rounded-[16px] bg-[#13131F] p-3 text-center text-sm text-[#56566E] border border-[#22223A]">
          UnderTable is currently in read-only mode. Check back soon!
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-[#18182A] bg-[#0E0E1A]">
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
        <div className="px-4 py-1.5 text-xs text-[#56566E] text-center bg-[#13131F]">
          You can send again in {slowModeTimer}s
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Composer box */}
        <div className="flex-1 flex items-end gap-2 rounded-[16px] border border-[#22223A] bg-[#13131F] px-3 py-2 transition-all duration-150 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30">
          {/* Action buttons */}
          <div className="flex items-center gap-1 pb-1">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-[11px] text-[#56566E] hover:bg-[#1A1530] hover:text-accent transition-all duration-150"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
            {!isConfessionBox && (
              <>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-[11px] text-[#56566E] hover:bg-[#1A1530] hover:text-accent transition-all duration-150"
                  onClick={onOpenGif}
                  title="Add GIF"
                >
                  <Image className="h-4 w-4" />
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-[11px] text-[#56566E] hover:bg-[#1A1530] hover:text-accent transition-all duration-150"
                  onClick={onOpenPoll}
                  title="Create poll"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Text input */}
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
            className="flex-1 resize-none bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-[#4A4A60] disabled:opacity-50"
            rows={1}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!content.trim() || isSending || slowModeTimer > 0}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-150 shrink-0',
              content.trim() && !isSending && slowModeTimer === 0
                ? 'bg-accent-gradient text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50'
                : 'bg-[#22223A] text-[#56566E]'
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Emoji picker popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 z-50">
          <div className="rounded-[16px] border border-[#22223A] bg-[#13131F] shadow-xl p-2">
            <div className="grid grid-cols-8 gap-1">
              {['👍', '❤️', '😂', '🔥', '😮', '🎉', '🙏', '💯',
                '✨', '🚀', '👀', '💪', '🤔', '😅', '🥳', '👏',
                '🙌', '💜', '⭐', '🌈', '🦄', '🍕', '🎸', '🌟'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="h-8 w-8 flex items-center justify-center rounded-[8px] hover:bg-[#1A1530] transition-colors duration-150 text-lg"
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
