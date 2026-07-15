'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/database.types'

type DBMessage = Database['public']['Tables']['messages']['Row']
type DBProfile = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'anonymous_name' | 'avatar_color'
>
type DBReaction = Pick<
  Database['public']['Tables']['reactions']['Row'],
  'id' | 'emoji' | 'user_id' | 'message_id'
>
type DBMessageWithReply = Pick<DBMessage, 'id' | 'content' | 'user_id'>

export interface Reaction {
  id: string
  emoji: string
  user_id: string
}

export interface ReplyPreview {
  id: string
  content: string
  sender_name: string
  sender_color: string
}

export interface Message extends DBMessage {
  sender_name: string
  sender_color: string
  reply_preview: ReplyPreview | null
  reactions: Reaction[]
}

interface UseMessagesOptions {
  roomId: string
  limit?: number
}

interface UseMessagesReturn {
  messages: Message[]
  loading: boolean
  error: string | null
  sendMessage: (
    content: string,
    replyTo?: string | null,
    expiresAt?: string | null
  ) => Promise<DBMessage | null>
  editMessage: (messageId: string, content: string) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  refresh: () => Promise<void>
}

const UNKNOWN_NAME = 'Unknown'
const FALLBACK_COLOR = '#7C3AED'

export function useMessages({
  roomId,
  limit = 100,
}: UseMessagesOptions): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  // Caches populated by the initial fetch and updated incrementally.
  const profileCacheRef = useRef<Map<string, DBProfile>>(new Map())
  const replyCacheRef = useRef<Map<string, ReplyPreview>>(new Map())

  // Mirror of `messages` so the realtime effect (which intentionally does not
  // re-subscribe on every message change) can read the current reaction state
  // when reconciling UPDATE events instead of a stale first-render snapshot.
  const messagesRef = useRef<Message[]>([])
  messagesRef.current = messages

  const upsertMessage = useCallback((m: Message) => {
    setMessages((prev) => {
      const idx = prev.findIndex((x) => x.id === m.id)
      if (idx === -1) {
        // Keep list ordered by created_at.
        const next = [...prev, m]
        next.sort((a, b) => a.created_at.localeCompare(b.created_at))
        return next
      }
      const next = prev.slice()
      next[idx] = { ...next[idx], ...m }
      return next
    })
  }, [])

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        // Drop messages whose TTL has elapsed but the cleanup job hasn't
        // removed them yet. `expires_at` is nullable for non-expiring messages.
        // PostgREST doesn't evaluate `now()` as a SQL function inside a
        // `.or()` filter string -- it was being compared as the literal text
        // "now()", which fails to cast to timestamptz. Pass an actual ISO
        // timestamp computed client-side instead.
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (msgErr) throw msgErr
      if (!msgs || msgs.length === 0) {
        setMessages([])
        return
      }

      const userIds = [...new Set(msgs.map((m) => m.user_id))]
      const msgIds = msgs.map((m) => m.id)
      const replyIds = msgs
        .filter((m) => m.reply_to)
        .map((m) => m.reply_to as string)

      const [profilesRes, reactionsRes, replyMsgsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, anonymous_name, avatar_color')
          .in('id', userIds),
        supabase
          .from('reactions')
          .select('id, emoji, user_id, message_id')
          .in('message_id', msgIds),
        replyIds.length > 0
          ? supabase
              .from('messages')
              .select('id, content, user_id')
              .in('id', replyIds)
          : Promise.resolve({ data: [] as DBMessageWithReply[], error: null }),
      ])

      // Update caches.
      const profileMap = profileCacheRef.current
      for (const p of profilesRes.data ?? []) {
        profileMap.set(p.id, p)
      }

      const reactionsByMsg = new Map<string, Reaction[]>()
      for (const r of (reactionsRes.data ?? []) as DBReaction[]) {
        const list = reactionsByMsg.get(r.message_id) ?? []
        list.push({ id: r.id, emoji: r.emoji, user_id: r.user_id })
        reactionsByMsg.set(r.message_id, list)
      }

      const replyMap = replyCacheRef.current
      // Resolve reply senders in one go.
      const replyUserIds = [
        ...new Set(
          ((replyMsgsRes.data ?? []) as DBMessageWithReply[]).map((r) => r.user_id)
        ),
      ]
      if (replyUserIds.length > 0) {
        const { data: replyProfiles } = await supabase
          .from('profiles')
          .select('id, anonymous_name, avatar_color')
          .in('id', replyUserIds)
        for (const p of replyProfiles ?? []) {
          profileMap.set(p.id, p)
        }
      }
      for (const r of (replyMsgsRes.data ?? []) as DBMessageWithReply[]) {
        const p = profileMap.get(r.user_id)
        const preview: ReplyPreview = {
          id: r.id,
          content: r.content,
          sender_name: p?.anonymous_name ?? UNKNOWN_NAME,
          sender_color: p?.avatar_color ?? FALLBACK_COLOR,
        }
        replyMap.set(r.id, preview)
      }

      const assembled: Message[] = msgs.map((m) => {
        const profile = profileMap.get(m.user_id)
        const reply = m.reply_to ? replyMap.get(m.reply_to) ?? null : null
        return {
          ...(m as DBMessage),
          sender_name: profile?.anonymous_name ?? UNKNOWN_NAME,
          sender_color: profile?.avatar_color ?? FALLBACK_COLOR,
          reply_preview: reply,
          reactions: reactionsByMsg.get(m.id) ?? [],
        }
      })

      setMessages(assembled)
    } catch (err) {
      console.error('Failed to load messages:', err)
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [roomId, limit, supabase])

  // Realtime: apply inserts/updates/deletes in place to preserve scroll
  // position and reduce network/CPU pressure.
  useEffect(() => {
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const applyChange = async (
      eventType: 'INSERT' | 'UPDATE' | 'DELETE',
      newRow: Partial<DBMessage> | null,
      oldRow: Partial<DBMessage> | null
    ) => {
      const row = (newRow ?? oldRow) as DBMessage | undefined
      if (!row || row.room_id !== roomId) return
      if (eventType === 'DELETE') {
        removeMessage(row.id)
        return
      }
      // If the message was soft-deleted, drop it from the list.
      if (row.is_deleted) {
        removeMessage(row.id)
        return
      }
      // Make sure we know the sender's profile.
      let profile = profileCacheRef.current.get(row.user_id)
      if (!profile) {
        const { data } = await supabase
          .from('profiles')
          .select('id, anonymous_name, avatar_color')
          .eq('id', row.user_id)
          .single()
        if (data) {
          profileCacheRef.current.set(data.id, data)
          profile = data
        }
      }
      // Resolve reply preview (if any).
      let replyPreview: ReplyPreview | null = null
      if (row.reply_to) {
        const cached = replyCacheRef.current.get(row.reply_to)
        if (cached) {
          replyPreview = cached
        } else {
          const { data: replyRow } = await supabase
            .from('messages')
            .select('id, content, user_id')
            .eq('id', row.reply_to)
            .single()
          if (replyRow) {
            let replyProfile = profileCacheRef.current.get(replyRow.user_id)
            if (!replyProfile) {
              const { data: rp } = await supabase
                .from('profiles')
                .select('id, anonymous_name, avatar_color')
                .eq('id', replyRow.user_id)
                .single()
              if (rp) {
                profileCacheRef.current.set(rp.id, rp)
                replyProfile = rp
              }
            }
            replyPreview = {
              id: replyRow.id,
              content: replyRow.content,
              sender_name: replyProfile?.anonymous_name ?? UNKNOWN_NAME,
              sender_color: replyProfile?.avatar_color ?? FALLBACK_COLOR,
            }
            replyCacheRef.current.set(replyRow.id, replyPreview)
          }
        }
      }
      upsertMessage({
        ...(row as DBMessage),
        sender_name: profile?.anonymous_name ?? UNKNOWN_NAME,
        sender_color: profile?.avatar_color ?? FALLBACK_COLOR,
        reply_preview: replyPreview,
        // FIX: read from `messagesRef.current` (kept in sync above) instead of
        // the closed-over `messages` state. The realtime effect intentionally
        // runs once per roomId so its closure captures the initial empty
        // array — using `messages` here caused UPDATE events to ALWAYS reset
        // reactions to [], effectively wiping reactions on every message
        // edit. Using the ref always reads the latest snapshot.
        reactions:
          (messagesRef.current.find((m) => m.id === row.id)?.reactions) ?? [],
      })
    }

    const setup = async () => {
      try {
        channel = supabase
          .channel(`messages:${roomId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `room_id=eq.${roomId}`,
            },
            (payload) => {
              if (cancelled) return
              void applyChange(
                payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
                payload.new as Partial<DBMessage> | null,
                payload.old as Partial<DBMessage> | null
              )
            }
          )
          .subscribe((status, err) => {
            if (err) console.error('Realtime subscription error:', err)
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              // Surface to the UI as a soft error so the user can retry.
              setError('Realtime connection lost — pull to refresh.')
            }
          })
      } catch (err) {
        console.error('Failed to setup realtime channel:', err)
      }
    }

    void setup()

    return () => {
      cancelled = true
      if (channel) {
        try {
          void supabase.removeChannel(channel)
        } catch (err) {
          console.error('Failed to remove channel:', err)
        }
      }
    }
    // We intentionally don't depend on `messages` — the apply callback
    // reads from the latest ref via setMessages' functional form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, supabase])

  // Initial fetch
  useEffect(() => {
    void fetchMessages()
  }, [fetchMessages])

  const sendMessage = useCallback(
    async (
      content: string,
      replyTo?: string | null,
      expiresAt?: string | null
    ): Promise<DBMessage | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error: insertErr } = await supabase
        .from('messages')
        .insert({
          room_id: roomId,
          user_id: user.id,
          content,
          reply_to: replyTo || null,
          expires_at: expiresAt || null,
        })
        .select('*')
        .single()

      if (insertErr) throw insertErr
      // The realtime event will normally upsert it; this is a fallback.
      if (data) {
        const profile = profileCacheRef.current.get(data.user_id)
        upsertMessage({
          ...(data as DBMessage),
          sender_name: profile?.anonymous_name ?? UNKNOWN_NAME,
          sender_color: profile?.avatar_color ?? FALLBACK_COLOR,
          reply_preview: data.reply_to
            ? replyCacheRef.current.get(data.reply_to) ?? null
            : null,
          reactions: [],
        })
      }
      return (data as DBMessage) ?? null
    },
    [roomId, supabase, upsertMessage]
  )

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const { error: updateErr } = await supabase
        .from('messages')
        .update({ content, is_edited: true })
        .eq('id', messageId)
      if (updateErr) throw updateErr
    },
    [supabase]
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const { error: updateErr } = await supabase
        .from('messages')
        .update({ is_deleted: true })
        .eq('id', messageId)
      if (updateErr) throw updateErr
      // Optimistically remove from the local list.
      removeMessage(messageId)
    },
    [supabase, removeMessage]
  )

  return {
    messages,
    loading,
    error,
    sendMessage,
    editMessage,
    deleteMessage,
    refresh: fetchMessages,
  }
}
