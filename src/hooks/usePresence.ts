'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PresenceUser {
  user_id: string
  anonymous_name: string
  avatar_color: string
  current_room: string | null
  ghost_mode?: boolean
}

export function usePresence() {
  const [visibleUsers, setVisibleUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const supabase = useRef(createClient()).current
  const channelRef = useRef<any>(null)
  const profileRef = useRef<any>(null)
  const typingChannelRef = useRef<any>(null)
  const currentRoomRef = useRef<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || !mounted) return

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
                  const presences = state[key] as any[]
                  if (presences?.[0]) {
                    users.push(presences[0] as PresenceUser)
                  }
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
                  })
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

    init()

    return () => {
      mounted = false
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
          })
        }
        // Clean up old typing channel
        if (typingChannelRef.current) {
          try {
            supabase.removeChannel(typingChannelRef.current)
          } catch (err) {
            console.error('Failed to remove old typing channel:', err)
          }
          typingChannelRef.current = null
        }
        setTypingUsers([])
        // Create new typing channel for this room
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
