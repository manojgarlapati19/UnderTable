'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pin, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

interface PinnedMessagesBarProps {
  roomId: string
  accentColor: string
  isAdmin?: boolean
  isOpen?: boolean
  onToggleOpen?: () => void
  onJumpToMessage?: (messageId: string) => void
}

type PinnedMessage = {
  id: string
  message_id: string
  created_at: string
  messages: { content: string; profiles: { anonymous_name: string } } | null
}

export default function PinnedMessagesBar({
  roomId,
  accentColor,
  isAdmin,
  isOpen: isOpenProp,
  onToggleOpen,
  onJumpToMessage,
}: PinnedMessagesBarProps) {
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([])
  const [isOpenLocal, setIsOpenLocal] = useState(false)
  // Allow the parent (e.g. the header "Pin" button) to control open state,
  // while still working standalone if no controlled props are passed.
  const isOpen = isOpenProp ?? isOpenLocal
  const toggleOpen = onToggleOpen ?? (() => setIsOpenLocal((v) => !v))
  // FIX: hoist into a ref so we don't recreate the Supabase client (and
  // its realtime listeners / cookie subscriptions) on every render.
  const supabase = useRef(createClient()).current

  const loadPinnedMessages = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('pinned_messages')
        .select(`
          id,
          message_id,
          created_at,
          messages!inner(content, profiles!inner(anonymous_name))
        `)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(3)

      if (data) setPinnedMessages(data as unknown as PinnedMessage[])
    } catch (err) {
      console.error('Failed to load pinned messages:', err)
    }
  }, [roomId, supabase])

  useEffect(() => {
    loadPinnedMessages()

    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupChannel = async () => {
      try {
        channel = supabase
          .channel(`pinned-messages-${roomId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'pinned_messages',
              filter: `room_id=eq.${roomId}`,
            },
            () => {
              loadPinnedMessages()
            }
          )
          .subscribe((status, err) => {
            if (err) {
              console.error('Pinned messages subscription error:', err)
            }
          })
      } catch (err) {
        console.error('Failed to setup pinned messages channel:', err)
      }
    }

    setupChannel()

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch (err) {
          console.error('Failed to remove pinned messages channel:', err)
        }
      }
    }
  }, [roomId, supabase, loadPinnedMessages])

  const handleUnpin = useCallback(
    async (pinnedId: string) => {
      try {
        const { error } = await supabase.from('pinned_messages').delete().eq('id', pinnedId)
        if (error) {
          toast.error('Failed to unpin message')
          return
        }
        setPinnedMessages((prev) => prev.filter((pm) => pm.id !== pinnedId))
        toast.success('Message unpinned')
      } catch (err) {
        console.error('Failed to unpin message:', err)
        toast.error('Failed to unpin message')
      }
    },
    [supabase]
  )

  if (pinnedMessages.length === 0) return null

  return (
    <div className="border-b border-[rgba(255,255,255,0.08)]" style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}>
      <button
        onClick={toggleOpen}
        className="flex items-center gap-2 px-4 py-1.5 text-xs text-[rgba(255,255,255,0.45)] hover:text-white transition-colors duration-150 w-full"
      >
        <Pin className="h-3 w-3" />
        <span>{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
      </button>

      {isOpen && (
        <ScrollArea className="max-h-32 px-4 pb-2">
          <div className="space-y-1">
            {pinnedMessages.map((pm) => (
              <div key={pm.id} className="group flex items-start gap-2 py-1">
                <Pin className="h-3 w-3 text-[#A78BFA] mt-0.5 shrink-0" />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onJumpToMessage?.(pm.message_id)}
                >
                  <p className="text-xs text-[rgba(255,255,255,0.45)]">
                    <span className="font-medium text-white">
                      {pm.messages?.profiles?.anonymous_name}
                    </span>
                  </p>
                  <p className="text-xs text-[rgba(255,255,255,0.45)] truncate">
                    {pm.messages?.content}
                  </p>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleUnpin(pm.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-[rgba(255,255,255,0.45)] hover:text-white transition-opacity"
                    title="Unpin"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
