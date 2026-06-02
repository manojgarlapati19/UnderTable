'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimePresenceState } from '@supabase/supabase-js'

interface PresenceUser {
  user_id: string
  anonymous_name: string
  avatar_color: string
  current_room: string | null
  ghost_mode: boolean
  last_seen: string
  is_idle: boolean
  typing: boolean
}

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([])
  const [currentProfile, setCurrentProfile] = useState<{
    user_id: string
    anonymous_name: string
    avatar_color: string
    ghost_mode: boolean
  } | null>(null)
  const supabase = createClient()
  const channelRef = useRef<any>(null)
  const idleTimerRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    initPresence()
    return () => {
      channelRef.current?.unsubscribe()
      clearTimeout(idleTimerRef.current)
    }
  }, [])

  async function initPresence() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, anonymous_name, avatar_color, ghost_mode')
      .eq('id', user.id)
      .single()

    if (!profile) return

    setCurrentProfile({
      user_id: user.id,
      anonymous_name: profile.anonymous_name,
      avatar_color: profile.avatar_color,
      ghost_mode: profile.ghost_mode,
    })

    const channel = supabase.channel('online-users', {
      config: { presence: { key: 'online-users' } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: PresenceUser[] = []

        for (const key in state) {
          const presences = state[key] as any[]
          if (presences?.length > 0) {
            const p = presences[0]
            users.push({
              user_id: p.user_id,
              anonymous_name: p.anonymous_name,
              avatar_color: p.avatar_color,
              current_room: p.current_room || null,
              ghost_mode: p.ghost_mode || false,
              last_seen: p.last_seen || new Date().toISOString(),
              is_idle: p.is_idle || false,
              typing: p.typing || false,
            })
          }
        }

        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            anonymous_name: profile.anonymous_name,
            avatar_color: profile.avatar_color,
            current_room: null,
            ghost_mode: profile.ghost_mode,
            last_seen: new Date().toISOString(),
            is_idle: false,
            typing: false,
          })
        }
      })

    channelRef.current = channel

    // Idle detection
    const resetIdle = () => {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(async () => {
        await channel.track({ is_idle: true })
      }, 2 * 60 * 1000)
    }

    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetIdle))
    resetIdle()
  }

  const updateCurrentRoom = useCallback(
    async (roomId: string | null) => {
      if (channelRef.current) {
        await channelRef.current.track({ current_room: roomId })
      }
    },
    []
  )

  const setTyping = useCallback(
    async (typing: boolean) => {
      if (channelRef.current) {
        await channelRef.current.track({ typing })
      }
    },
    []
  )

  const visibleUsers = onlineUsers.filter((u) => !u.ghost_mode)
  const ghostUsers = onlineUsers.filter((u) => u.ghost_mode)

  return {
    onlineUsers,
    visibleUsers,
    ghostUsers,
    currentProfile,
    updateCurrentRoom,
    setTyping,
  }
}
