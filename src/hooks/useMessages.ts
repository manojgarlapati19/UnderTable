'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

interface UseMessagesOptions {
  roomId: string
  limit?: number
}

interface MessageWithRelations extends Tables<'messages'> {
  profile: { anonymous_name: string; avatar_color: string } | null
  reactions: Array<{
    id: string
    emoji: string
    user_id: string
  }>
  reply_message: {
    content: string
    profile: { anonymous_name: string } | null
  } | null
}

export function useMessages({ roomId, limit = 100 }: UseMessagesOptions) {
  const [messages, setMessages] = useState<MessageWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useRef(createClient()).current

  const MESSAGE_SELECT = `
    *,
    profile:profiles!messages_user_id_fkey(anonymous_name, avatar_color),
    reactions(id, emoji, user_id),
    reply_message:messages!messages_reply_to_fkey(id, content)
  `

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error: fetchError } = await supabase
        .from('messages')
        .select(MESSAGE_SELECT)
        .eq('room_id', roomId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (fetchError) throw fetchError
      setMessages((data as MessageWithRelations[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [roomId, limit, supabase])

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`messages-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select(MESSAGE_SELECT)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages((prev) => [...prev, data as MessageWithRelations])
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select(MESSAGE_SELECT)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? (data as MessageWithRelations) : m))
            )
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reactions' },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select(MESSAGE_SELECT)
            .eq('id', payload.new.message_id)
            .single()

          if (data) {
            setMessages((prev) =>
              prev.map((m) => (m.id === data.id ? (data as MessageWithRelations) : m))
            )
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'reactions' },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === payload.old.message_id) {
                return {
                  ...m,
                  reactions: m.reactions?.filter((r) => r.id !== payload.old.id) || [],
                }
              }
              return m
            })
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [roomId, fetchMessages, supabase])

  const sendMessage = useCallback(
    async (content: string, replyTo?: string | null, expiresAt?: string | null) => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: sendError } = await supabase.from('messages').insert({
        room_id: roomId,
        user_id: user.id,
        content,
        reply_to: replyTo || null,
        expires_at: expiresAt || null,
      })

      if (sendError) throw sendError
    },
    [roomId, supabase]
  )

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const { error: editError } = await supabase
        .from('messages')
        .update({ content, is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', messageId)

      if (editError) throw editError
    },
    [supabase]
  )

  const deleteMessage = useCallback(
    async (messageId: string) => {
      const { error: deleteError } = await supabase
        .from('messages')
        .update({ is_deleted: true, content: 'this message was removed' })
        .eq('id', messageId)

      if (deleteError) throw deleteError
    },
    [supabase]
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