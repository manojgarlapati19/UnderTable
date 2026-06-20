'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getAvatarGradient } from '@/lib/utils/avatar-color'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils/cn'

interface ReadReceiptsProps {
  messageId: string
  maxVisible?: number
}

interface ReceiptUser {
  user_id: string
  anonymous_name: string
  avatar_color: string
}

export default function ReadReceipts({ messageId, maxVisible = 5 }: ReadReceiptsProps) {
  const [readers, setReaders] = useState<ReceiptUser[]>([])
  // FIX: hoist into a ref so we don't recreate the Supabase client (and
  // its realtime listeners / cookie subscriptions) on every render.
  const supabase = useRef(createClient()).current

  useEffect(() => {
    loadReaders()

    let channel: ReturnType<typeof supabase.channel> | null = null

    const setupChannel = async () => {
      try {
        channel = supabase
          .channel(`read-receipts-${messageId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'read_receipts',
              filter: `message_id=eq.${messageId}`,
            },
            () => {
              loadReaders()
            }
          )
          .subscribe((status, err) => {
            if (err) {
              console.error('Read receipts subscription error:', err)
            }
          })
      } catch (err) {
        console.error('Failed to setup read receipts channel:', err)
      }
    }

    setupChannel()

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch (err) {
          console.error('Failed to remove read receipts channel:', err)
        }
      }
    }
  }, [messageId])

  interface ReadReceiptsRow {
    user_id: string
    profiles: { anonymous_name: string; avatar_color: string } | null
  }

  async function loadReaders() {
    try {
      const { data } = await supabase
        .from('read_receipts')
        .select(`
          user_id,
          profiles!inner(anonymous_name, avatar_color)
        `)
        .eq('message_id', messageId)
        .limit(maxVisible + 1)
        .returns<ReadReceiptsRow[]>()

      if (data) {
        const users: ReceiptUser[] = data
          .filter((r): r is ReadReceiptsRow & { profiles: { anonymous_name: string; avatar_color: string } } => r.profiles !== null)
          .map((r) => ({
            user_id: r.user_id,
            anonymous_name: r.profiles.anonymous_name,
            avatar_color: r.profiles.avatar_color,
          }))
        setReaders(users)
      }
    } catch (err) {
      console.error('Failed to load read receipts:', err)
    }
  }

  if (readers.length === 0) return null

  const visible = readers.slice(0, maxVisible)
  const extra = readers.length - maxVisible

  const tooltipText = readers.map((r) => r.anonymous_name).join(', ')

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center -space-x-1.5 mt-1">
            {visible.map((reader, i) => (
              <Avatar
                key={reader.user_id}
                className={cn(
                  'h-4 w-4 border-2 border-transparent',
                  i > 0 && '-ml-1.5'
                )}
              >
                <AvatarFallback
                  style={{ background: getAvatarGradient(reader.anonymous_name) }}
                  className="text-[6px] text-white font-medium"
                >
                  {reader.anonymous_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
            ))}
            {extra > 0 && (
              <span className="text-[10px] text-[rgba(255,255,255,0.45)] ml-1">+{extra} more</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
