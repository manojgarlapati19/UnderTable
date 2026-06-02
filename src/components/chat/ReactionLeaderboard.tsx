'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { getAvatarColor } from '@/lib/utils/avatar-color'
import { cn } from '@/lib/utils/cn'

interface LeaderboardEntry {
  rank: number
  user_id: string
  anonymous_name: string
  avatar_color: string
  reaction_count: number
  reaction_breakdown: Record<string, number>
}

export default function ReactionLeaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadLeaderboard()
  }, [])

  async function loadLeaderboard() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Get all reactions in the past 7 days with user info
    const { data: reactions } = await supabase
      .from('reactions')
      .select(`
        user_id,
        emoji,
        messages!inner(user_id)
      `)
      .gte('created_at', sevenDaysAgo)

    if (!reactions) {
      setLoading(false)
      return
    }

    // Count reactions received per user (user_id in messages, not reaction user_id)
    const countMap = new Map<string, { count: number; breakdown: Record<string, number> }>()

    reactions.forEach((r: any) => {
      const targetUserId = r.messages?.user_id
      if (!targetUserId) return

      const existing = countMap.get(targetUserId) || { count: 0, breakdown: {} }
      existing.count++
      existing.breakdown[r.emoji] = (existing.breakdown[r.emoji] || 0) + 1
      countMap.set(targetUserId, existing)
    })

    // Sort and take top 10
    const sorted = [...countMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)

    if (sorted.length === 0) {
      setLoading(false)
      return
    }

    // Get profile info
    const userIds = sorted.map(([id]) => id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, anonymous_name, avatar_color, hide_from_leaderboard')
      .in('id', userIds)

    if (profiles) {
      const profileMap = new Map(profiles.map((p) => [p.id, p]))

      const leaderboard: LeaderboardEntry[] = sorted
        .map(([userId, stats], index) => {
          const profile = profileMap.get(userId)
          return {
            rank: index + 1,
            user_id: userId,
            anonymous_name: profile?.anonymous_name || 'Unknown',
            avatar_color: profile?.avatar_color || getAvatarColor('Unknown'),
            reaction_count: stats.count,
            reaction_breakdown: stats.breakdown,
          }
        })
        .filter((entry) => {
          const profile = profileMap.get(entry.user_id)
          return !profile?.hide_from_leaderboard
        })

      setEntries(leaderboard)
    }

    setLoading(false)
  }

  const rankColors = ['text-yellow-500', 'text-gray-400', 'text-amber-600']

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-6 w-6 skeleton rounded" />
            <div className="h-8 w-8 skeleton rounded-full" />
            <div className="h-4 w-24 skeleton rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Trophy className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No leaderboard data this week</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-5 w-5 text-yellow-500" />
        <h2 className="text-sm font-semibold text-foreground">Reaction Leaderboard</h2>
        <Badge variant="secondary" className="text-[10px]">This week</Badge>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-1">
          {entries.map((entry) => (
            <div
              key={entry.user_id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2',
                entry.rank <= 3 ? 'bg-yellow-500/5' : 'hover:bg-sidebar-hover'
              )}
            >
              <span className={cn(
                'text-sm font-bold w-6 text-center',
                rankColors[entry.rank - 1] || 'text-muted-foreground'
              )}>
                #{entry.rank}
              </span>
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  style={{ backgroundColor: entry.avatar_color }}
                  className="text-white text-xs"
                >
                  {entry.anonymous_name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {entry.anonymous_name}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {Object.entries(entry.reaction_breakdown).map(([emoji, count]) => (
                    <span key={emoji}>{emoji} {count}</span>
                  ))}
                </div>
              </div>
              <span className="text-sm font-semibold text-primary">{entry.reaction_count}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
