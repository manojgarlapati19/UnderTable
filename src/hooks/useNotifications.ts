'use client'

import { useCallback } from 'react'

export function useNotifications() {
  const notifyNewMessage = useCallback((roomName: string, content: string) => {
    try {
      if (typeof window === 'undefined') return
      if (!('Notification' in window)) return
      if (Notification.permission !== 'granted') return

      new Notification(`#${roomName}`, {
        body: 'Someone sent a message',
        icon: '/icon.png',
      })
    } catch (err) {
      console.error('Notification error:', err)
    }
  }, [])

  return { notifyNewMessage }
}
