'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  const supabase = useMemo(() => createClient(), [])
  const channelRef = useRef<any>(null)
  const typingChannelRef = useRef<any>(null)
  const currentRoomRef = useRef<string | null>(null)
  const idleTimerRef = useRef<NodeJS.Timeout>()
  const profileRef = useRef<typeof currentProfile>(null)

  useEffect(() => {
    let cleanupActivity: (() => void) | undefined
    initPresence().then((cleanup) => { cleanupActivity = cleanup })
    return () => {
      cleanupActivity?.()
      channelRef.current?.unsubscribe()
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current)
      clearTimeout(idleTimerRef.current)
    }
  }, [])

  async function initPresence(): Promise<(() => void) | undefined> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, anonymous_name, avatar_color, ghost_mode')
      .eq('id', user.id)
      .single()

    if (!profile) return

    const profileData = {
      user_id: user.id,
      anonymous_name: profile.anonymous_name,
      avatar_color: profile.avatar_color,
      ghost_mode: profile.ghost_mode,
    }
    setCurrentProfile(profileData)
    profileRef.current = profileData

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

    // Idle detection — always merge full profile so partial track doesn't wipe state
    const resetIdle = () => {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(async () => {
        if (profileRef.current) {
          await channel.track({
            ...profileRef.current,
            current_room: currentRoomRef.current,
            last_seen: new Date().toISOString(),
            is_idle: true,
            typing: false,
          })
        }
      }, 2 * 60 * 1000)
    }

    const handleActivity = () => {
      if (profileRef.current) {
        channel.track({
          ...profileRef.current,
          current_room: currentRoomRef.current,
          last_seen: new Date().toISOString(),
          is_idle: false,
          typing: false,
        })
      }
      resetIdle()
    }

    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart']
    events.forEach((e) => window.addEventListener(e, handleActivity))
    resetIdle()

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity))
      clearTimeout(idleTimerRef.current)
    }
  }

  const updateCurrentRoom = useCallback(
    async (roomId: string | null) => {
      currentRoomRef.current = roomId
      if (channelRef.current && profileRef.current) {
        await channelRef.current.track({
          ...profileRef.current,
          current_room: roomId,
          last_seen: new Date().toISOString(),
          is_idle: false,
          typing: false,
        })
      }
      // Clean up old typing channel
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current)
        typingChannelRef.current = null
      }
      // Create new typing channel for this room
      if (roomId && profileRef.current) {
        const typingChannel = supabase.channel(`typing:${roomId}`, {
          config: { presence: { key: `typing-${roomId}` } },
        })
        typingChannel.subscribe()
        typingChannelRef.current = typingChannel
      }
    },
    [supabase]
  )

  const setTyping = useCallback(
    async (typing: boolean) => {
      if (typingChannelRef.current && profileRef.current) {
        await typingChannelRef.current.track({
          user_id: profileRef.current.user_id,
          anonymous_name: profileRef.current.anonymous_name,
          typing,
        })
      }
      // Also update global presence
      if (channelRef.current) {
        await channelRef.current.track({ typing })
      }
    },
    [supabase]
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
