'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Smile, Image, Send, X, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import ReplyPreview from './ReplyPreview'

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😊',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒'],
  },
  {
    name: 'People',
    icon: '👋',
    emojis: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '💪', '🦾', '🙏', '🤝', '👏', '🙌', '🤲', '🫶', '❤️', '🧡', '💛', '💚', '💙', '💜'],
  },
  {
    name: 'Animals',
    icon: '🐶',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🦇', '🐝', '🦋', '🐛', '🐌', '🐞', '🐜', '🦟', '🦗'],
  },
  {
    name: 'Food',
    icon: '🍕',
    emojis: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥖', '🫓', '🥨', '🧀', '🥗', '🥙', '🥪', '🌮', '🌯', '🫔', '🍜', '🍝', '🍛', '🍣', '🍱', '🍦', '🍰', '🎂', '🍩'],
  },
  {
    name: 'Activities',
    icon: '⚽',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '🎯', '🎳', '🎮', '🕹️', '🎲', '♟️', '🎭', '🎨', '🖼️', '🎪', '🎤', '🎧', '🎵', '🎶', '🎸', '🎹', '🥁', '🎺'],
  },
  {
    name: 'Objects',
    icon: '🚀',
    emojis: ['💻', '📱', '⌨️', '🖥️', '🖨️', '🖱️', '💾', '💿', '📷', '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🧭', '⏱️', '⏰', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '💰', '💳', '🔑', '🗝️'],
  },
  {
    name: 'Nature',
    icon: '🌍',
    emojis: ['🌍', '🌎', '🌏', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', '🌛', '🌜', '☀️', '🌝', '🌞', '🪐', '⭐', '🌟', '💫', '✨', '☄️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️'],
  },
  {
    name: 'Symbols',
    icon: '💯',
    emojis: ['💯', '✅', '☑️', '✔️', '❌', '❎', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '💠', '🔷', '🔶', '🔹', '🔸', '▪️', '▫️', '🚫', '⛔', '📛', '🔞', '💢', '♨️', '🚷'],
  },
]

const EMOJI_NAMES: Record<string, string> = {
  '😀': 'grinning', '😃': 'smiley', '😄': 'smile', '😁': 'grin', '😆': 'laughing',
  '😅': 'sweat_smile', '😂': 'joy', '🤣': 'rofl', '😊': 'blush', '😇': 'innocent',
  '🙂': 'slight_smile', '🙃': 'upside_down', '😉': 'wink', '😌': 'relieved',
  '😍': 'heart_eyes', '🥰': 'heart_eyes_adoration', '😘': 'kiss', '😗': 'kissing',
  '😙': 'kissing_smiling_eyes', '😚': 'kissing_closed_eyes', '😋': 'yum',
  '😛': 'stuck_out_tongue', '😝': 'stuck_out_tongue_winking_eye',
  '😜': 'stuck_out_tongue_closed_eyes', '🤪': 'zany', '🤨': 'raised_eyebrow',
  '🧐': 'face_with_monocle', '🤓': 'nerd', '😎': 'sunglasses',
  '🥸': 'disguised_face', '🤩': 'star_struck', '🥳': 'partying_face',
  '😏': 'smirk', '😒': 'unamused', '👍': 'thumbsup', '👎': 'thumbsdown',
  '❤️': 'heart', '🧡': 'orange_heart', '💛': 'yellow_heart', '💚': 'green_heart',
  '💙': 'blue_heart', '💜': 'purple_heart', '🔥': 'fire', '🎉': 'party',
  '✨': 'sparkles', '🚀': 'rocket', '💪': 'muscle', '🙏': 'pray',
  '👏': 'clap', '🙌': 'raised_hands', '🎶': 'notes', '⭐': 'star',
  '🌈': 'rainbow', '🍕': 'pizza', '🎸': 'guitar', '🌟': 'glowing_star',
  '👀': 'eyes', '💯': 'hundred',  '😮': 'open_mouth',
}

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
  onTypingChange,
}: MessageInputProps) {
  const [content, setContent] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [slowModeTimer, setSlowModeTimer] = useState(0)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiCategory, setEmojiCategory] = useState(0)
  const [emojiSearch, setEmojiSearch] = useState('')
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('recent_emojis') || '[]')
      } catch { return [] }
    }
    return []
  })
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionUsers, setMentionUsers] = useState<{ user_id: string; anonymous_name: string }[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const emojiPickerRef = useRef<HTMLDivElement>(null)
  const mentionRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = useRef(createClient()).current

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [content])

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      // Notify parent we stopped typing
      onTypingChange?.(false)
    }
  }, [onTypingChange])

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

  // Close emoji picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false)
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showEmojiPicker])

  // Close mention menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mentionRef.current && !mentionRef.current.contains(e.target as Node)) {
        setShowMentionMenu(false)
      }
    }
    if (showMentionMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMentionMenu])

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

  // @mention detection
  function handleMentionDetection(value: string, cursorPos: number) {
    const beforeCursor = value.slice(0, cursorPos)
    const atMatch = beforeCursor.match(/@(\w*)$/)
    if (atMatch) {
      const query = atMatch[1].toLowerCase()
      setMentionQuery(query)
      setMentionIndex(0)

      // Fetch users from profiles table matching the query
      supabase
        .from('profiles')
        .select('id, anonymous_name')
        .ilike('anonymous_name', `%${query}%`)
        .limit(8)
        .then(({ data }) => {
          if (data) {
            setMentionUsers(data.map(p => ({ user_id: p.id, anonymous_name: p.anonymous_name })))
            setShowMentionMenu(data.length > 0)
          }
        })
    } else {
      setShowMentionMenu(false)
    }
  }

  function insertMention(user: { anonymous_name: string }) {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const beforeCursor = content.slice(0, cursorPos)
    const afterCursor = content.slice(cursorPos)
    const atIndex = beforeCursor.lastIndexOf('@')
    const newContent = beforeCursor.slice(0, atIndex) + `@${user.anonymous_name} ` + afterCursor

    setContent(newContent)
    setShowMentionMenu(false)

    // Set cursor position after the inserted mention
    const newCursorPos = atIndex + user.anonymous_name.length + 2
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

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
    if (showMentionMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((prev) => Math.min(prev + 1, mentionUsers.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (mentionUsers[mentionIndex]) {
          insertMention(mentionUsers[mentionIndex])
        }
        return
      }
      if (e.key === 'Escape') {
        setShowMentionMenu(false)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape') {
      onDismissReply()
      setShowEmojiPicker(false)
    }
  }

  function insertEmoji(emoji: string) {
    setContent((prev) => prev + emoji)
    setShowEmojiPicker(true) // Keep picker open for multiple selections

    // Add to recent emojis
    setRecentEmojis((prev) => {
      const updated = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 8)
      if (typeof window !== 'undefined') {
        localStorage.setItem('recent_emojis', JSON.stringify(updated))
      }
      return updated
    })

    textareaRef.current?.focus()
  }

  // Filter emojis by search
  const filteredCategories = EMOJI_CATEGORIES.map((cat) => ({
    ...cat,
    emojis: emojiSearch
      ? cat.emojis.filter((e) => {
          const name = EMOJI_NAMES[e] || ''
          return name.includes(emojiSearch.toLowerCase()) || e.includes(emojiSearch)
        })
      : cat.emojis,
  })).filter((cat) => cat.emojis.length > 0)

  if (isReadonly) {
    return (
      <div className="border-t border-[rgba(255,255,255,0.08)] p-4">
        <div className="glass-card rounded-[14px] p-3 text-center text-sm text-[rgba(255,255,255,0.45)]">
          UnderTable is currently in read-only mode. Check back soon!
        </div>
      </div>
    )
  }

  return (
    <div className="relative border-t border-[rgba(255,255,255,0.08)]">
      {/* Reply preview — clearly visible above input */}
      {replyTo && (
        <div className="px-4 pt-2">
          <ReplyPreview
            senderName={replyTo.senderName}
            content={replyTo.content}
            onDismiss={onDismissReply}
          />
        </div>
      )}

      {/* Slow mode indicator */}
      {slowModeTimer > 0 && (
        <div className="px-4 py-1.5 text-xs text-[rgba(255,255,255,0.45)] text-center bg-[rgba(255,255,255,0.05)]">
          You can send again in {slowModeTimer}s
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Composer box */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            gap: '6px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '15px',
            padding: '7px 7px 7px 13px',
            transition: 'all 0.15s',
          }}
          className="focus-within:border-[rgba(167,139,250,0.6)] focus-within:shadow-[0_0_0_3px_rgba(167,139,250,0.12)]"
        >
          {/* Action buttons */}
          <div className="flex items-center gap-1 pb-1">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-[11px] text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#A78BFA] transition-all duration-150"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
            {!isConfessionBox && (
              <>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-[11px] text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#A78BFA] transition-all duration-150"
                  onClick={onOpenGif}
                  title="Add GIF"
                >
                  <Image className="h-4 w-4" />
                </button>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-[11px] text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.1)] hover:text-[#A78BFA] transition-all duration-150"
                  onClick={onOpenPoll}
                  title="Create poll"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value)
                handleInput()
                handleMentionDetection(e.target.value, e.target.selectionStart)
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Message as ${profileName}...`}
              disabled={slowModeTimer > 0}
              className="w-full resize-none bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-[rgba(255,255,255,0.35)] disabled:opacity-50"
              rows={1}
            />

            {/* @mention dropdown */}
            {showMentionMenu && mentionUsers.length > 0 && (
              <div
                ref={mentionRef}
                className="absolute bottom-full left-0 mb-1 z-50 w-56 rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(30,27,75,0.98)] backdrop-blur-[28px] shadow-xl overflow-hidden"
              >
                {mentionUsers.map((user, index) => (
                  <button
                    key={user.user_id}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-sm text-left transition-colors duration-100',
                      index === mentionIndex
                        ? 'bg-[rgba(167,139,250,0.2)] text-[#C4B5FD]'
                        : 'text-white hover:bg-[rgba(255,255,255,0.06)]'
                    )}
                    onClick={() => insertMention(user)}
                    onMouseEnter={() => setMentionIndex(index)}
                  >
                    <span className="h-6 w-6 rounded-full bg-[rgba(167,139,250,0.3)] flex items-center justify-center text-xs text-[#C4B5FD]">
                      {user.anonymous_name.charAt(0)}
                    </span>
                    <span className="font-medium">@{user.anonymous_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!content.trim() || isSending || slowModeTimer > 0}
            style={{
              display: 'flex',
              height: '36px',
              width: '36px',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '11px',
              transition: 'all 0.15s',
              flexShrink: 0,
              ...(content.trim() && !isSending && slowModeTimer === 0
                ? {
                    background: 'linear-gradient(135deg, #A78BFA, #F0ABFC)',
                    color: '#1E1B4B',
                    boxShadow: '0 3px 10px rgba(167,139,250,0.4)',
                    cursor: 'pointer',
                  }
                : {
                    background: 'rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.45)',
                    cursor: 'not-allowed',
                  }),
            }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded emoji picker */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full left-4 mb-2 z-50 animate-slide-up"
        >
          <div className="w-[340px] rounded-[14px] border border-[rgba(255,255,255,0.12)] bg-[rgba(30,27,75,0.98)] backdrop-blur-[28px] shadow-2xl overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-[rgba(255,255,255,0.08)]">
              <input
                type="text"
                value={emojiSearch}
                onChange={(e) => setEmojiSearch(e.target.value)}
                placeholder="Search emojis..."
                className="w-full rounded-[8px] bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs text-white outline-none placeholder:text-[rgba(255,255,255,0.35)]"
                autoFocus
              />
            </div>

            {/* Category tabs */}
            <div className="flex gap-0.5 px-2 py-1.5 overflow-x-auto border-b border-[rgba(255,255,255,0.08)]">
              {EMOJI_CATEGORIES.map((cat, i) => (
                <button
                  key={cat.name}
                  onClick={() => setEmojiCategory(i)}
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-sm transition-all duration-150',
                    i === emojiCategory && !emojiSearch
                      ? 'bg-[rgba(167,139,250,0.2)]'
                      : 'hover:bg-[rgba(255,255,255,0.08)]'
                  )}
                  title={cat.name}
                >
                  {cat.icon}
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="max-h-48 overflow-y-auto p-2">
              {/* Recently used */}
              {!emojiSearch && recentEmojis.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] text-[rgba(255,255,255,0.35)] uppercase tracking-wider mb-1 px-1">
                    Recently Used
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {recentEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="h-8 w-8 flex items-center justify-center rounded-[8px] hover:bg-[rgba(255,255,255,0.1)] transition-colors duration-150 text-lg"
                        title={EMOJI_NAMES[emoji] || emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-[rgba(255,255,255,0.08)] mt-2" />
                </div>
              )}

              {/* Category emojis */}
              {(emojiSearch ? filteredCategories : [EMOJI_CATEGORIES[emojiCategory]]).map((cat) => (
                <div key={cat.name} className="mb-1">
                  {emojiSearch && (
                    <p className="text-[10px] text-[rgba(255,255,255,0.35)] uppercase tracking-wider mb-1 px-1">
                      {cat.icon} {cat.name}
                    </p>
                  )}
                  <div className="grid grid-cols-8 gap-0.5">
                    {cat.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="h-8 w-8 flex items-center justify-center rounded-[8px] hover:bg-[rgba(255,255,255,0.1)] transition-colors duration-150 text-lg"
                        title={EMOJI_NAMES[emoji] || emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {emojiSearch && filteredCategories.length === 0 && (
                <p className="text-center text-xs text-[rgba(255,255,255,0.35)] py-4">
                  No emojis found
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
