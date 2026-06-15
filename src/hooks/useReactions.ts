'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ReactionState {
  count: number
  hasReacted: boolean
  names: string[]
}

export function useReactions(messageId: string, currentUserId: string) {
  const [reactions, setReactions] = useState<Record<string, ReactionState>>({})
  const supabase = useRef(createClient()).current
  const reactionsRef = useRef(reactions)
  reactionsRef.current = reactions // always keep ref in sync

  const toggleReaction = useCallback(
    async (emoji: string) => {
      // Always read the LATEST reactions state via ref, not the closure
      const current = reactionsRef.current[emoji]
      const isAdding = !current?.hasReacted

      // Optimistic update
      setReactions((prev) => {
        const next = { ...prev }
        if (isAdding) {
          next[emoji] = {
            count: (next[emoji]?.count || 0) + 1,
            hasReacted: true,
            names: [...(next[emoji]?.names || []), 'You'],
          }
        } else if (next[emoji]) {
          next[emoji] = {
            count: Math.max(0, (next[emoji]?.count || 1) - 1),
            hasReacted: false,
            names: next[emoji].names.filter((n) => n !== 'You'),
          }
        }
        return next
      })

      try {
        if (isAdding) {
          await supabase.from('reactions').insert({
            message_id: messageId,
            user_id: currentUserId,
            emoji,
          })
        } else {
          await supabase
            .from('reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', currentUserId)
            .eq('emoji', emoji)
        }
      } catch {
        // Revert on error
        setReactions((prev) => {
          const next = { ...prev }
          if (!isAdding) {
            next[emoji] = {
              count: (next[emoji]?.count || 0) + 1,
              hasReacted: true,
              names: [...(next[emoji]?.names || []), 'You'],
            }
          } else if (next[emoji]) {
            next[emoji] = {
              count: Math.max(0, (next[emoji]?.count || 1) - 1),
              hasReacted: false,
              names: next[emoji].names.filter((n) => n !== 'You'),
            }
          }
          return next
        })
      }
    },
    [messageId, currentUserId, reactions, supabase]
  )

  const setReactionsFromServer = useCallback(
    (serverReactions: Array<{ emoji: string; user_id: string; profiles?: { anonymous_name: string } | null }>) => {
      const grouped: Record<string, ReactionState> = {}
      serverReactions.forEach((r) => {
        if (!grouped[r.emoji]) {
          grouped[r.emoji] = { count: 0, hasReacted: false, names: [] }
        }
        grouped[r.emoji].count++
        if (r.user_id === currentUserId) grouped[r.emoji].hasReacted = true
        if (r.profiles?.anonymous_name) {
          grouped[r.emoji].names.push(r.profiles.anonymous_name)
        }
      })
      setReactions(grouped)
    },
    [currentUserId]
  )

  return { reactions, toggleReaction, setReactionsFromServer }
}
