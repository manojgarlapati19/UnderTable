'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/lib/supabase/database.types'

interface PollVote {
  option_id: string
  user_id: string
}

export function usePolls(roomId: string, currentUserId: string) {
  const [polls, setPolls] = useState<Tables<'polls'>[]>([])
  const [pollVotes, setPollVotes] = useState<Record<string, PollVote[]>>({})
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadPolls()
    subscribeToPolls()

    return () => {
      supabase.removeAllChannels()
    }
  }, [roomId])

  async function loadPolls() {
    const { data } = await supabase
      .from('polls')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })

    if (data) {
      setPolls(data)
      // Load votes for all polls
      data.forEach((poll) => loadVotes(poll.id))
    }
    setLoading(false)
  }

  async function loadVotes(pollId: string) {
    const { data } = await supabase
      .from('poll_votes')
      .select('option_id, user_id')
      .eq('poll_id', pollId)

    if (data) {
      setPollVotes((prev) => ({ ...prev, [pollId]: data }))
    }
  }

  function subscribeToPolls() {
    const channel = supabase
      .channel(`polls-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'polls', filter: `room_id=eq.${roomId}` },
        () => loadPolls()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'poll_votes' },
        (payload) => {
          setPollVotes((prev) => ({
            ...prev,
            [payload.new.poll_id]: [
              ...(prev[payload.new.poll_id] || []),
              { option_id: payload.new.option_id, user_id: payload.new.user_id },
            ],
          }))
        }
      )
      .subscribe()
  }

  const vote = useCallback(
    async (pollId: string, optionId: string) => {
      const { error } = await supabase.from('poll_votes').insert({
        poll_id: pollId,
        user_id: currentUserId,
        option_id: optionId,
      })

      if (error && error.code !== '23505') {
        throw error
      }
    },
    [currentUserId, supabase]
  )

  const closePoll = useCallback(
    async (pollId: string) => {
      await supabase.from('polls').update({ is_closed: true }).eq('id', pollId)
    },
    [supabase]
  )

  return {
    polls,
    pollVotes,
    loading,
    vote,
    closePoll,
  }
}
