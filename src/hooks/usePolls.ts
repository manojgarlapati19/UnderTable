'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  // FIX: hoist into a ref so we don't recreate the Supabase client (and
  // its realtime listeners / cookie subscriptions) on every render.
  const supabase = useRef(createClient()).current

  useEffect(() => {
    let cancelled = false

    async function loadPolls() {
      const { data } = await supabase
        .from('polls')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (!data) {
        setLoading(false)
        return
      }

      // FIX: previously `data.forEach((poll) => loadVotes(poll.id))` fired
      // N parallel requests without awaiting, then `setLoading(false)` ran
      // immediately. The UI rendered with empty `pollVotes` for a flash.
      // Now we fetch votes for every poll in one round trip via `.in()`.
      const pollIds = data.map((p) => p.id)
      const votesByPoll: Record<string, PollVote[]> = {}
      if (pollIds.length > 0) {
        const { data: votesData } = await supabase
          .from('poll_votes')
          .select('option_id, user_id, poll_id')
          .in('poll_id', pollIds)
        if (!cancelled) {
          for (const v of votesData ?? []) {
            const list = votesByPoll[v.poll_id] ?? []
            list.push({ option_id: v.option_id, user_id: v.user_id })
            votesByPoll[v.poll_id] = list
          }
        }
      }

      if (cancelled) return
      setPolls(data)
      setPollVotes(votesByPoll)
      setLoading(false)
    }

    function subscribeToPolls() {
      // FIX: previously every realtime poll event triggered a full re-fetch
      // of all polls + all votes (O(n) per event, O(n²) per minute). Now
      // we mutate state incrementally: insert/update/delete the affected
      // poll, and append/remove the affected vote.
      const channel = supabase
        .channel(`polls:${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'polls',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const inserted = payload.new as Tables<'polls'>
            setPolls((prev) => {
              if (prev.some((p) => p.id === inserted.id)) return prev
              return [inserted, ...prev]
            })
            // No votes yet for a freshly inserted poll.
            setPollVotes((prev) => ({ ...prev, [inserted.id]: [] }))
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'polls',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const updated = payload.new as Tables<'polls'>
            setPolls((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            )
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'polls',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const old = payload.old as { id: string }
            setPolls((prev) => prev.filter((p) => p.id !== old.id))
            setPollVotes((prev) => {
              const next = { ...prev }
              delete next[old.id]
              return next
            })
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'poll_votes' },
          (payload) => {
            const v = payload.new as { poll_id: string; option_id: string; user_id: string }
            setPollVotes((prev) => ({
              ...prev,
              [v.poll_id]: [
                ...(prev[v.poll_id] || []),
                { option_id: v.option_id, user_id: v.user_id },
              ],
            }))
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'poll_votes' },
          (payload) => {
            const v = payload.old as { poll_id: string; option_id: string; user_id: string }
            setPollVotes((prev) => ({
              ...prev,
              [v.poll_id]: (prev[v.poll_id] || []).filter(
                (vote) => !(vote.option_id === v.option_id && vote.user_id === v.user_id)
              ),
            }))
          }
        )
        .subscribe()
      return channel
    }

    loadPolls()
    const channel = subscribeToPolls()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [roomId, supabase])

  const vote = useCallback(
    async (pollId: string, optionId: string) => {
      // FIX: also surface the unique-constraint error as an explicit
      // warning rather than silently swallowing it. A user double-clicking
      // a poll option now sees no-op rather than a silent failed insert.
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
      // FIX: return the error so callers can surface it; previously any
      // RLS rejection (e.g. non-admin attempting to close) was swallowed
      // and the UI showed the button "work".
      const { error } = await supabase
        .from('polls')
        .update({ is_closed: true })
        .eq('id', pollId)
      if (error) throw error
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