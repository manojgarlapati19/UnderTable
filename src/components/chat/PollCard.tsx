'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { formatDate } from '@/lib/utils/time'
import { useTheme } from 'next-themes'
import type { Tables } from '@/lib/supabase/database.types'

interface PollCardProps {
  poll: Tables<'polls'>
  isAdmin: boolean
  currentUserId: string
}

interface PollOption {
  id: string
  text: string
  votes: number
}

export default function PollCard({ poll, isAdmin, currentUserId }: PollCardProps) {
  const supabase = createClient()
  const { theme } = useTheme()
  const [options, setOptions] = useState<PollOption[]>(() => {
    try {
      return typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options
    } catch { return [] }
  })
  const [userVote, setUserVote] = useState<string | null>(null)
  const [totalVotes, setTotalVotes] = useState(0)
  const isClosed = poll.is_closed || (poll.expires_at ? new Date(poll.expires_at) < new Date() : false)
  const isDark = theme === 'dark'

  useEffect(() => {
    loadVotes()
    subscribeToVotes()
  }, [poll.id])

  async function loadVotes() {
    const { data } = await supabase
      .from('poll_votes')
      .select('option_id, user_id')
      .eq('poll_id', poll.id)

    if (data) {
      const voteCounts: Record<string, number> = {}
      data.forEach((v) => {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1
        if (v.user_id === currentUserId) setUserVote(v.option_id)
      })

      setOptions((prev) =>
        prev.map((opt) => ({
          ...opt,
          votes: voteCounts[opt.id] || 0,
        }))
      )
      setTotalVotes(data.length)
    }
  }

  function subscribeToVotes() {
    const channel = supabase
      .channel(`poll-votes-${poll.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${poll.id}` },
        () => loadVotes()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }

  async function handleVote(optionId: string) {
    if (userVote || isClosed) return

    const { error } = await supabase
      .from('poll_votes')
      .insert({ poll_id: poll.id, user_id: currentUserId, option_id: optionId })

    if (!error) {
      setUserVote(optionId)
    }
  }

  async function handleClosePoll() {
    await supabase.from('polls').update({ is_closed: true }).eq('id', poll.id)
  }

  const chartData = options.map((opt) => ({
    name: opt.text,
    votes: opt.votes,
    percentage: totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0,
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-foreground">{poll.question}</h3>
        {isClosed && (
          <Badge variant="secondary" className="shrink-0">Poll closed</Badge>
        )}
      </div>

      {/* Voting or results */}
      {!userVote && !isClosed ? (
        <div className="space-y-1.5">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleVote(option.id)}
              className="w-full text-left rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary hover:bg-primary/5"
            >
              {option.text}
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: isDark ? '#94A3B8' : '#64748B' }}
                  width={80}
                />
                <Bar dataKey="votes" fill="#7C3AED" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Vote counts */}
          <div className="space-y-1">
            {options.map((option) => (
              <div key={option.id} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{option.text}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">
                    {totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          {poll.expires_at && !isClosed && (
            <span>Ends {formatDate(poll.expires_at)}</span>
          )}
          {isAdmin && !isClosed && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={handleClosePoll}>
              Close poll
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
