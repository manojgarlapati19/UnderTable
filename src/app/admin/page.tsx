'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import StatsCards from '@/components/admin/StatsCards'
import Link from 'next/link'
import { Link2, Plus, Users } from 'lucide-react'

export default function AdminDashboardPage() {
  const supabase = createClient()

  const [stats, setStats] = useState({
    totalMembers: 0,
    pendingApprovals: 0,
    activeToday: 0,
    messagesToday: 0,
    flaggedMessages: 0,
    roomsCount: 0,
  })

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      { count: totalMembers },
      { count: pendingApprovals },
      { count: messagesToday },
      { count: roomsCount },
      { count: flaggedMessages },
      { data: activeTodayRows },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_deleted', false).gte('created_at', today.toISOString()),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      // FIX: this previously did `.select('id').eq('is_flagged', true).limit(10)`
      // and used the *array length* as the count, so the dashboard silently
      // capped at 10 regardless of how many messages were actually flagged.
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_flagged', true).eq('is_deleted', false),
      // FIX: "Active Today" was hard-coded to 0 and never computed. Approximate
      // it as the number of distinct senders who posted a message today.
      supabase.from('messages').select('user_id').eq('is_deleted', false).gte('created_at', today.toISOString()),
    ])

    const activeToday = new Set((activeTodayRows || []).map((r) => r.user_id)).size

    setStats({
      totalMembers: totalMembers || 0,
      pendingApprovals: pendingApprovals || 0,
      activeToday,
      messagesToday: messagesToday || 0,
      flaggedMessages: flaggedMessages || 0,
      roomsCount: roomsCount || 0,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium text-white">Dashboard</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/invites">
              <Link2 className="h-4 w-4 mr-1" />
              Generate Invite Link
            </Link>
          </Button>
        </div>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button variant="outline" className="h-20 flex-col items-center justify-center gap-1 rounded-[14px]" asChild>
          <Link href="/admin/invites">
            <Link2 className="h-5 w-5" />
            <span className="text-xs">Generate Invite Link</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-20 flex-col items-center justify-center gap-1 rounded-[14px]" asChild>
          <Link href="/admin/rooms">
            <Plus className="h-5 w-5" />
            <span className="text-xs">Create Room</span>
          </Link>
        </Button>
        <Button variant="outline" className="h-20 flex-col items-center justify-center gap-1 rounded-[14px]" asChild>
          <Link href="/admin/members">
            <Users className="h-5 w-5" />
            <span className="text-xs">Manage Members</span>
          </Link>
        </Button>
      </div>
    </div>
  )
}
