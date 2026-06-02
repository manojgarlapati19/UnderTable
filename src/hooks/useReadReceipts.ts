'use client'

import { useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useReadReceipts(roomId: string) {
  const supabase = createClient()
  const observerRef = useRef<IntersectionObserver | null>(null)
  const seenMessagesRef = useRef<Set<string>>(new Set())

  const observeMessage = useCallback(
    (messageId: string, element: HTMLElement | null) => {
      if (!element) return

      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const id = entry.target.getAttribute('data-message-id')
                if (id && !seenMessagesRef.current.has(id)) {
                  seenMessagesRef.current.add(id)
                  markAsRead(id)
                }
              }
            })
          },
          { threshold: 0.5 }
        )
      }

      element.setAttribute('data-message-id', messageId)
      observerRef.current.observe(element)
    },
    []
  )

  async function markAsRead(messageId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Check if ghost mode is active
    const { data: profile } = await supabase
      .from('profiles')
      .select('ghost_mode')
      .eq('id', user.id)
      .single()

    if (profile?.ghost_mode) return

    const { error } = await supabase.from('read_receipts').insert({
      message_id: messageId,
      user_id: user.id,
    })

    if (error && error.code !== '23505') { // Not a duplicate (already read)
      console.error('Failed to mark as read:', error)
    }
  }

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  return { observeMessage }
}
