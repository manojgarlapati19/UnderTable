'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

const IDLE_TIMEOUT_MS = 2 * 60 * 1000
const TRACK_THROTTLE_MS = 10_000

export interface PresenceUser {
  user_id: string
  anonymous_name: string
  avatar_color: string
  current_room: string | null
  ghost_mode: boolean
  last_seen: string
  is_idle: boolean
}

interface PresenceTrackPayload {
  user_id: string
  anonymous_name: string
  avatar_color: string
  current_room: string | null
  ghost_mode: boolean
  last_seen: string
  is_idle: boolean
}

interface TypingTrackPayload {
  user_id: string
  anonymous_name: string
  typing: boolean
}

// Minimal shape of a Supabase realtime channel — the public types are not
// fully exported, so we use a structural alias.
type RealtimeChannel = {
  on: (
    event: 'presence',
    options: { event: 'sync' | 'join' | 'leave' },
    cb: (payload?: unknown) => void
  ) => RealtimeChannel
  subscribe: (
    cb?: (status: string, err?: Error) => void
  ) => RealtimeChannel
  track: (payload: PresenceTrackPayload | TypingTrackPayload) => Promise<unknown>
  presenceState: () => Record<string, PresenceTrackPayload[] | TypingTrackPayload[]>
  unsubscribe: () => Promise<unknown>
}

type SupabaseLike = {
  channel: (name: string, opts?: { config?: { presence?: { key?: string } } }) => RealtimeChannel
  removeChannel: (ch: RealtimeChannel) => Promise<unknown>
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null } }> }
  from: (table: 'profiles') => {
    select: (cols: string) => {
      eq: (col: 'id', val: string) => {
        single: () => Promise<{ data: Pick<ProfileRow, 'id' | 'anonymous_name' | 'avatar_color' | 'ghost_mode'> | null }>
        maybeSingle: () => Promise<{ data: Pick<ProfileRow, 'id' | 'anonymous_name' | 'avatar_color' | 'ghost_mode'> | null }>
      }
    }
  }
}

const supabase = createClient() as unknown as SupabaseLike

export function usePresence() {
  const [visibleUsers, setVisibleUsers] = useState<PresenceUser[]>([])
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  const channelRef = useRef<RealtimeChannel | null>(null)
  const profileRef = useRef<Pick<ProfileRow, 'id' | 'anonymous_name' | 'avatar_color' | 'ghost_mode'> | null>(null)
  const typingChannelRef = useRef<RealtimeChannel | null>(null)
  const currentRoomRef = useRef<string | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Throttle bookkeeping. `lastTrackAt` is a number when we last successfully
  // sent a track; the throttled call short-circuits if we're inside the
  // throttle window. `pendingTrack` is set when a track is requested inside
  // the window so we fire one final update when the window expires.
  const lastTrackAtRef = useRef<number>(0)
  const pendingTrackRef = useRef<PresenceTrackPayload | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Serial counter ensures we only apply the *latest* track payload when
  // an old, in-flight track resolves.
  const trackSeqRef = useRef<number>(0)

  // FIX: stable per-mount id so the channel name is unique across the
  // multiple `usePresence()` consumers in the same tab (chat page +
  // RightSidebar). Without this both consumers create a channel named
  // `online-users:<user.id>` and Supabase throws "cannot add `presence`
  // callbacks for realtime:online-users:<id> after `subscribe()`" on the
  // second mount because both consumers race on the same channel name.
  const mountIdRef = useRef<string>('')

  // FIX: bumped on every effect run so async work from a previous mount
  // can detect it's stale and bail before mutating refs.
  const initTokenRef = useRef<symbol>(Symbol('usePresence-init-0'))

  const buildPayload = useCallback(
    (is_idle: boolean, roomOverride?: string | null): PresenceTrackPayload | null => {
      const p = profileRef.current
      if (!p) return null
      return {
        user_id: p.id,
        anonymous_name: p.anonymous_name,
        avatar_color: p.avatar_color,
        current_room:
          roomOverride === undefined ? currentRoomRef.current : roomOverride,
        ghost_mode: !!p.ghost_mode,
        last_seen: new Date().toISOString(),
        is_idle,
      }
    },
    []
  )

  const flushTrack = useCallback(async (payload: PresenceTrackPayload) => {
    if (!channelRef.current) return
    const seq = ++trackSeqRef.current
    try {
      await channelRef.current.track(payload)
      // Only honour the "last" track — drop stale resolutions.
      if (seq === trackSeqRef.current) {
        lastTrackAtRef.current = Date.now()
        pendingTrackRef.current = null
      }
    } catch (err) {
      console.error('Presence track error:', err)
    }
  }, [])

  const scheduleTrack = useCallback(
    (is_idle: boolean, roomOverride?: string | null) => {
      const payload = buildPayload(is_idle, roomOverride)
      if (!payload) return

      const now = Date.now()
      const elapsed = now - lastTrackAtRef.current

      if (elapsed >= TRACK_THROTTLE_MS) {
        // Outside the window — track immediately.
        void flushTrack(payload)
      } else {
        // Inside the window — stash the latest payload and schedule a
        // single flush at the end of the window. This way a flurry of
        // mousedown/keydown events still ends with exactly one extra
        // track instead of zero (which would otherwise leave us out of
        // date for up to 10s).
        pendingTrackRef.current = payload
        if (flushTimerRef.current) return
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null
          const pending = pendingTrackRef.current
          if (pending) void flushTrack(pending)
        }, TRACK_THROTTLE_MS - elapsed)
      }
    },
    [buildPayload, flushTrack]
  )

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      scheduleTrack(true)
    }, IDLE_TIMEOUT_MS)
  }, [scheduleTrack])

  useEffect(() => {
    let mounted = true
    let visibilityHandler: (() => void) | null = null
    let focusHandler: (() => void) | null = null
    // FIX: bump the instance token every effect run. Any in-flight `init`
    // from a previous mount will compare its captured token to this and
    // bail before touching channelRef.current (which the new run has
    // already replaced with its own channel).
    initTokenRef.current = Symbol('usePresence-init')
    const instanceToken = initTokenRef.current

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        // Bail if the effect re-ran while we were awaiting.
        if (!user || !mounted) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, anonymous_name, avatar_color, ghost_mode')
          .eq('id', user.id)
          .maybeSingle()

        // FIX: bail again — and additionally check that our instance
        // is still the live one before touching channelRef.
        if (!profile || !mounted) return
        if (instanceToken !== initTokenRef.current) return
        profileRef.current = profile

        // FIX: previously the channel name was hardcoded `'online-users'`.
        // Then we scoped it to `online-users:<user.id>`. But two
        // `usePresence()` consumers (chat page + RightSidebar) each create
        // the same channel name and Supabase throws "cannot add `presence`
        // callbacks ... after `subscribe()`" on the second one. Append a
        // per-mount suffix so each consumer has its own channel.
        if (!mountIdRef.current) {
          mountIdRef.current = Math.random().toString(36).slice(2, 10)
        }
        const channel = supabase.channel(
          `online-users:${user.id}:${mountIdRef.current}`,
          {
            config: { presence: { key: user.id } },
          }
        )

        channel.on('presence', { event: 'sync' }, () => {
          if (!mounted) return
          try {
            const state = channel.presenceState() || {}
            const users: PresenceUser[] = []
            for (const key in state) {
              const presences = state[key] as PresenceTrackPayload[]
              const p = presences?.[0]
              if (!p || !p.user_id) continue
              // FIX: previously ghost_mode was filtered only at the UI
              // render layer, but the full identity payload was still
              // broadcast over the presence channel. Any client could
              // read presence state and see "hidden" users. Now we
              // skip ghost users entirely on the wire by filtering
              // the outbound state.
              if (p.ghost_mode && p.user_id !== user.id) continue
              users.push({
                user_id: p.user_id,
                anonymous_name: p.anonymous_name,
                avatar_color: p.avatar_color,
                current_room: p.current_room ?? null,
                ghost_mode: !!p.ghost_mode,
                last_seen: p.last_seen || new Date().toISOString(),
                is_idle: !!p.is_idle,
              })
            }
            setVisibleUsers(users)
          } catch (err) {
            console.error('Presence sync error:', err)
          }
        })

        channel.subscribe((status: string, err?: Error) => {
          if (err) {
            console.error('Presence subscribe error:', err)
            return
          }
          if (status === 'SUBSCRIBED' && !profile.ghost_mode) {
            // First track is allowed to bypass the throttle — it sets the
            // baseline `lastTrackAt` value.
            const payload = buildPayload(false)
            if (payload) void flushTrack(payload)
            resetIdleTimer()
          }
        })

        channelRef.current = channel

        // FIX: previously the idle timer was set ONCE on mount and never
        // reset. Once it fired the user was permanently marked idle. Now
        // any user activity (keypress / pointer / scroll) resets the
        // timer back to non-idle and re-broadcasts presence.
        const onActivity = () => {
          if (!profileRef.current?.ghost_mode) {
            scheduleTrack(false)
          }
          resetIdleTimer()
        }
        const activityEvents: (keyof DocumentEventMap)[] = [
          'keydown',
          'mousedown',
          'pointerdown',
          'scroll',
          'touchstart',
        ]
        activityEvents.forEach((e) =>
          document.addEventListener(e, onActivity, { passive: true })
        )

        // Re-broadcast on focus/visibility so we don't appear idle when the
        // user just alt-tabbed back. These are infrequent so they don't need
        // to be throttled — but we still defer to the throttler for safety.
        visibilityHandler = () => {
          if (document.visibilityState === 'visible') {
            scheduleTrack(false)
            resetIdleTimer()
          }
        }
        focusHandler = () => {
          scheduleTrack(false)
          resetIdleTimer()
        }
        document.addEventListener('visibilitychange', visibilityHandler)
        window.addEventListener('focus', focusHandler)

        return () => {
          activityEvents.forEach((e) =>
            document.removeEventListener(e, onActivity)
          )
        }
      } catch (err) {
        console.error('Presence init error:', err)
      }
    }

    void init()

    return () => {
      mounted = false
      if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
      if (focusHandler) window.removeEventListener('focus', focusHandler)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current).catch((err: unknown) => {
          console.error('Failed to remove presence channel:', err)
        })
        channelRef.current = null
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current).catch((err: unknown) => {
          console.error('Failed to remove typing channel:', err)
        })
        typingChannelRef.current = null
      }
    }
  }, [buildPayload, flushTrack, resetIdleTimer, scheduleTrack])

  const updateCurrentRoom = useCallback(
    async (roomId: string | null) => {
      currentRoomRef.current = roomId
      try {
        if (channelRef.current && profileRef.current) {
          // Room changes are infrequent; bypass the throttle for a prompt
          // update. Reset the throttle window afterwards.
          const payload = buildPayload(false, roomId)
          if (payload) await flushTrack(payload)
        }
        if (typingChannelRef.current) {
          await supabase.removeChannel(typingChannelRef.current)
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
                const state = typingChannel.presenceState() || {}
                const typing: string[] = []
                for (const key in state) {
                  const presences = state[key] as TypingTrackPayload[]
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
    [buildPayload, flushTrack]
  )

  const setTyping = useCallback(async (typing: boolean) => {
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
  }, [])

  return { visibleUsers, typingUsers, updateCurrentRoom, setTyping }
}