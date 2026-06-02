'use client'

import { useState, useEffect } from 'react'
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
  const supabase = createClient()

  useEffect(() => {
    loadReaders()

    const channel = supabase
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [messageId])

  async function loadReaders() {
    const { data } = await supabase
      .from('read_receipts')
      .select(`
        user_id,
        profiles!inner(anonymous_name, avatar_color)
      `)
      .eq('message_id', messageId)
      .limit(maxVisible + 1)

    if (data) {
      const users = data.map((r: any) => ({
        user_id: r.user_id,
        anonymous_name: r.profiles.anonymous_name,
        avatar_color: r.profiles.avatar_color,
      }))
      setReaders(users)
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
                  'h-4 w-4 border-2 border-[#0E0E1A]',
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
              <span className="text-[10px] text-[#56566E] ml-1">+{extra} more</span>
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
