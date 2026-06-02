'use client'

import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function useNotifications() {
  const supabase = createClient()

  useEffect(() => {
    requestPermission()
  }, [])

  async function requestPermission() {
    if (!('Notification' in window)) return

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        toast.success('Notifications enabled!')
      }
    }
  }

  const showNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!('Notification' in window)) return
      if (Notification.permission !== 'granted') return

      try {
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          ...options,
        })

        notification.onclick = () => {
          window.focus()
          if (options?.data?.url) {
            window.location.href = options.data.url
          }
        }
      } catch (error) {
        console.error('Failed to show notification:', error)
      }
    },
    []
  )

  const notifyNewMessage = useCallback(
    (roomName: string, messageContent: string, url?: string) => {
      showNotification(`💬 ${roomName}`, {
        body: messageContent,
        data: { url },
        tag: `message-${roomName}`,
      })
    },
    [showNotification]
  )

  const notifyMention = useCallback(
    (roomName: string, mentionedBy: string, url?: string) => {
      showNotification(`📣 You were mentioned in ${roomName}`, {
        body: `${mentionedBy} mentioned you`,
        data: { url },
        tag: `mention-${Date.now()}`,
      })
    },
    [showNotification]
  )

  const notifyAdminAction = useCallback(
    (message: string) => {
      showNotification('🔔 UnderTable', {
        body: message,
        tag: 'admin-action',
      })
    },
    [showNotification]
  )

  return {
    requestPermission,
    showNotification,
    notifyNewMessage,
    notifyMention,
    notifyAdminAction,
  }
}
