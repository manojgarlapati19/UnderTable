'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const IDLE_TIMEOUT_MS = 2 * 60 * 1000

export interface PresenceUser {
  user_id: string
  anonymous_name: string
  avatar_color: string
  current_room: string | null
  ghost_mode?: boolean
  last_seen: string
  is_idle: boolean
}

export function usePresence() {
  const [visibleUsers, setVisibleUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const supabase = useRef(createClient()).current
  // Supabase realtime channel types are not exported; keep as opaque refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const channelRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const typingChannelRef = useRef<any>(null)
  const currentRoomRef = useRef<string | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !mounted) return
        currentUserIdRef.current = user.id

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, anonymous_name, avatar_color, ghost_mode')
          .eq('id', user.id)
          .single()

        if (!profile || !mounted) return
        profileRef.current = profile

        try {
          channelRef.current = supabase.channel('online-users', {
            config: { presence: { key: user.id } }
          })

          channelRef.current
            .on('presence', { event: 'sync' }, () => {
              try {
                if (!mounted) return
                const state = channelRef.current?.presenceState() || {}
                const users: PresenceUser[] = []
                for (const key in state) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const presences = state[key] as any[]
                  const p = presences?.[0]
                  if (!p) continue
                  users.push({
                    user_id: p.user_id,
                    anonymous_name: p.anonymous_name,
                    avatar_color: p.avatar_color,
                    current_room: p.current_room ?? null,
                    ghost_mode: p.ghost_mode || false,
                    last_seen: p.last_seen || new Date().toISOString(),
                    is_idle: !!p.is_idle,
                  })
                }
                setVisibleUsers(
                  users.filter((u) => !u.ghost_mode || u.user_id === user.id)
                )
              } catch (err) {
                console.error('Presence sync error:', err)
              }
            })
            .subscribe(async (status: string, err?: Error) => {
              if (err) {
                console.error('Presence subscribe error:', err)
                return
              }
              if (status === 'SUBSCRIBED' && !profile.ghost_mode) {
                try {
                  await channelRef.current?.track({
                    user_id: user.id,
                    anonymous_name: profile.anonymous_name,
                    avatar_color: profile.avatar_color,
                    current_room: null,
                    ghost_mode: profile.ghost_mode || false,
                    last_seen: new Date().toISOString(),
                    is_idle: false,
                  })
                  resetIdleTimer()
                } catch (trackErr) {
                  console.error('Presence track error:', trackErr)
                }
              }
            })
        } catch (channelErr) {
          console.error('Failed to create presence channel:', channelErr)
        }
      } catch (err) {
        console.error('Presence init error:', err)
      }
    }

    function resetIdleTimer() {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        if (!channelRef.current || !profileRef.current) return
        channelRef.current.track({
          user_id: profileRef.current.id,
          anonymous_name: profileRef.current.anonymous_name,
          avatar_color: profileRef.current.avatar_color,
          current_room: currentRoomRef.current,
          ghost_mode: profileRef.current.ghost_mode || false,
          last_seen: new Date().toISOString(),
          is_idle: true,
        }).catch((err: unknown) => console.error('Idle track error:', err))
      }, IDLE_TIMEOUT_MS)
    }

    function handleActivity() {
      if (!channelRef.current || !profileRef.current) {
        resetIdleTimer()
        return
      }
      channelRef.current.track({
        user_id: profileRef.current.id,
        anonymous_name: profileRef.current.anonymous_name,
        avatar_color: profileRef.current.avatar_color,
        current_room: currentRoomRef.current,
        ghost_mode: profileRef.current.ghost_mode || false,
        last_seen: new Date().toISOString(),
        is_idle: false,
      }).catch((err: unknown) => console.error('Activity track error:', err))
      resetIdleTimer()
    }

    init()

    const events = ['mousedown', 'keydown', 'touchstart']
    events.forEach((event) => window.addEventListener(event, handleActivity))

    return () => {
      mounted = false
      events.forEach((event) => window.removeEventListener(event, handleActivity))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current)
        } catch (err) {
          console.error('Failed to remove presence channel:', err)
        }
        channelRef.current = null
      }
      if (typingChannelRef.current) {
        try {
          supabase.removeChannel(typingChannelRef.current)
        } catch (err) {
          console.error('Failed to remove typing channel:', err)
        }
        typingChannelRef.current = null
      }
    }
  }, [supabase])

  const updateCurrentRoom = useCallback(
    async (roomId: string | null) => {
      currentRoomRef.current = roomId
      try {
        if (channelRef.current && profileRef.current) {
          await channelRef.current.track({
            user_id: profileRef.current.id,
            anonymous_name: profileRef.current.anonymous_name,
            avatar_color: profileRef.current.avatar_color,
            current_room: roomId,
            ghost_mode: profileRef.current.ghost_mode || false,
            last_seen: new Date().toISOString(),
            is_idle: false,
          })
        }
        if (typingChannelRef.current) {
          try {
            supabase.removeChannel(typingChannelRef.current)
          } catch (err) {
            console.error('Failed to remove old typing channel:', err)
          }
          typingChannelRef.current = null
        }
        setTypingUsers([])
        if (roomId && profileRef.current) {
          const typingChannel = supabase.channel(`typing:${roomId}`, {
            config: { presence: { key: `typing-${profileRef.current.id}` } },
          })
          typingChannel
            .on('presence', { event: 'sync' }, () => {
              try {
                const state = typingChannel?.presenceState() || {}
                const typing: string[] = []
                for (const key in state) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const presences = state[key] as any[]
                  presences?.forEach((p) => {
                    if (
                      p.typing &&
                      p.user_id !== profileRef.current?.id &&
                      p.anonymous_name
                    ) {
                      typing.push(p.anonymous_name)
                    }
                  })
                }
                setTypingUsers(typing)
              } catch (err) {
                console.error('Typing presence sync error:', err)
              }
            })
            .subscribe((status: string, err?: Error) => {
              if (err) {
                console.error('Typing channel subscribe error:', err)
              }
            })
          typingChannelRef.current = typingChannel
        }
      } catch (err) {
        console.error('Failed to update current room:', err)
      }
    },
    [supabase]
  )

  const setTyping = useCallback(
    async (typing: boolean) => {
      try {
        if (typingChannelRef.current && profileRef.current) {
          await typingChannelRef.current.track({
            user_id: profileRef.current.id,
            anonymous_name: profileRef.current.anonymous_name,
            typing,
          })
        }
      } catch (err) {
        console.error('Failed to set typing:', err)
      }
    },
    []
  )

  return { visibleUsers, typingUsers, updateCurrentRoom, setTyping }
}
