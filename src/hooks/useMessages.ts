'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface SimpleMessage {
  id: string
  room_id: string
  user_id: string
  content: string
  reply_to: string | null
  is_edited: boolean
  is_deleted: boolean
  is_pinned: boolean
  is_flagged: boolean
  expires_at: string | null
  created_at: string
  updated_at: string
  sender_name: string
  sender_color: string
  reply_content: string | null
  reactions: Array<{ id: string; emoji: string; user_id: string }>
}

export function useMessages({ roomId, limit = 100 }: { roomId: string; limit?: number }) {
  const [messages, setMessages] = useState<SimpleMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useRef(createClient()).current

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Step 1: fetch raw messages
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (msgErr) throw msgErr
      if (!msgs || msgs.length === 0) {
        setMessages([])
        return
      }

      // Step 2: fetch profiles for all senders
      const userIds = [...new Set(msgs.map((m) => m.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, anonymous_name, avatar_color')
        .in('id', userIds)

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      )

      // Step 3: fetch reactions
      const msgIds = msgs.map((m) => m.id)
      const { data: reactions } = await supabase
        .from('reactions')
        .select('id, emoji, user_id, message_id')
        .in('message_id', msgIds)

      const reactionsMap = new Map<string, Array<{ id: string; emoji: string; user_id: string }>>()
      for (const r of reactions || []) {
        if (!reactionsMap.has(r.message_id)) reactionsMap.set(r.message_id, [])
        reactionsMap.get(r.message_id)!.push({ id: r.id, emoji: r.emoji, user_id: r.user_id })
      }

      // Step 4: fetch reply messages
      const replyIds = msgs.filter((m) => m.reply_to).map((m) => m.reply_to!)
      const replyMap = new Map<string, string>()
      if (replyIds.length > 0) {
        const { data: replyMsgs } = await supabase
          .from('messages')
          .select('id, content')
          .in('id', replyIds)
        for (const r of replyMsgs || []) {
          replyMap.set(r.id, r.content)
        }
      }

      // Step 5: assemble
      const assembled: SimpleMessage[] = msgs.map((m) => ({
        ...m,
        sender_name: profileMap.get(m.user_id)?.anonymous_name || 'Unknown',
        sender_color: profileMap.get(m.user_id)?.avatar_color || '#7C3AED',
        reply_content: m.reply_to ? (replyMap.get(m.reply_to) || null) : null,
        reactions: reactionsMap.get(m.id) || [],
      }))

      setMessages(assembled)
    } catch (err) {
      console.error('Failed to load messages:', err)
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [roomId, limit, supabase])

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`,
      }, () => {
        fetchMessages()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reactions',
      }, () => {
        fetchMessages()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [roomId, fetchMessages, supabase])

  const sendMessage = useCallback(async (
    content: string,
    replyTo?: string | null
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase.from('messages').insert({
      room_id: roomId,
      user_id: user.id,
      content,
      reply_to: replyTo || null,
    })

    if (error) throw error
  }, [roomId, supabase])

  const editMessage = useCallback(async (messageId: string, content: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ content, is_edited: true })
      .eq('id', messageId)
    if (error) throw error
  }, [supabase])

  const deleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true })
      .eq('id', messageId)
    if (error) throw error
  }, [supabase])

  return { messages, loading, error, sendMessage, editMessage, deleteMessage, refresh: fetchMessages }
}