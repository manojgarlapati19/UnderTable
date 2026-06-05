'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { Pin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface PinnedMessagesBarProps {
  roomId: string
  accentColor: string
}

export default function PinnedMessagesBar({ roomId, accentColor }: PinnedMessagesBarProps) {
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const supabase = createClient()

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
  }, [roomId])

  async function loadPinnedMessages() {
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

      if (data) setPinnedMessages(data)
    } catch (err) {
      console.error('Failed to load pinned messages:', err)
    }
  }

  if (pinnedMessages.length === 0) return null

  return (
    <div className="border-b border-[rgba(255,255,255,0.08)]" style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-1.5 text-xs text-[rgba(255,255,255,0.45)] hover:text-white transition-colors duration-150 w-full"
      >
        <Pin className="h-3 w-3" />
        <span>{pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? 's' : ''}</span>
      </button>

      {isOpen && (
        <ScrollArea className="max-h-32 px-4 pb-2">
          <div className="space-y-1">
            {pinnedMessages.map((pm) => (
              <div key={pm.id} className="flex items-start gap-2 py-1">
                <Pin className="h-3 w-3 text-[#A78BFA] mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-[rgba(255,255,255,0.45)]">
                    <span className="font-medium text-white">
                      {pm.messages?.profiles?.anonymous_name}
                    </span>
                  </p>
                  <p className="text-xs text-[rgba(255,255,255,0.45)] truncate">
                    {pm.messages?.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
