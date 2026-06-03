'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import StatsCards from '@/components/admin/StatsCards'
import {
  Link2,
  Plus,
  Shield,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'

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

  const [recentActions, setRecentActions] = useState<any[]>([])

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
      { data: flaggedMessages },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('id').eq('is_flagged', true).limit(10),
    ])

    setStats({
      totalMembers: totalMembers || 0,
      pendingApprovals: pendingApprovals || 0,
      activeToday: 0,
      messagesToday: messagesToday || 0,
      flaggedMessages: flaggedMessages?.length || 0,
      roomsCount: roomsCount || 0,
    })
  }

  async function generateInviteLink() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const code = uuidv4().slice(0, 8)
    const { error } = await supabase.from('invite_links').insert({
      code,
      created_by: user.id,
    })

    if (!error) {
      const url = `${window.location.origin}/invite/${code}`
      await navigator.clipboard.writeText(url)
      toast.success('Invite link copied to clipboard!')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium text-white">Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={generateInviteLink}>
            <Link2 className="h-4 w-4 mr-1" />
            Generate Invite Link
          </Button>
        </div>
      </div>

      <StatsCards stats={stats} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button variant="outline" className="h-20 flex-col items-center justify-center gap-1 rounded-[14px]">
          <Link2 className="h-5 w-5" />
          <span className="text-xs">Generate Invite Link</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col items-center justify-center gap-1 rounded-[14px]">
          <Plus className="h-5 w-5" />
          <span className="text-xs">Create Room</span>
        </Button>
        <Button variant="outline" className="h-20 flex-col items-center justify-center gap-1 rounded-[14px]">
          <Shield className="h-5 w-5" />
          <span className="text-xs">Maintenance Mode</span>
        </Button>
      </div>
    </div>
  )
}
