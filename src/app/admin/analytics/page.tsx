'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useTheme } from 'next-themes'
import { Loader2 } from 'lucide-react'

export default function AdminAnalyticsPage() {
  const supabase = createClient()
  const { theme } = useTheme()
  const [timeRange, setTimeRange] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [messageData, setMessageData] = useState<any[]>([])
  const [hourData, setHourData] = useState<any[]>([])
  const [roomData, setRoomData] = useState<any[]>([])
  const [reactionData, setReactionData] = useState<any[]>([])
  const [memberGrowth, setMemberGrowth] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalMembers: 0,
    activeToday: 0,
    roomsCount: 0,
    avgMessagesPerDay: 0,
  })

  const isDark = true
  const textColor = 'rgba(255,255,255,0.7)'

  useEffect(() => {
    loadData()
  }, [timeRange])

  async function loadData() {
    setLoading(true)
    const daysAgo = timeRange === 'today' ? 1 : timeRange === '7d' ? 7 : 30
    const startDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('created_at')
        .gte('created_at', startDate)
        .eq('is_deleted', false)

      if (messages) {
        const dayCounts: Record<string, number> = {}
        const hourCounts: Record<string, number> = {}
        const dayNames: Record<string, string> = {}

        messages.forEach((m) => {
          const date = new Date(m.created_at)
          const dayKey = date.toISOString().slice(0, 10)
          const hourKey = date.getHours().toString()

          dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1
          hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1

          if (!dayNames[dayKey]) {
            dayNames[dayKey] = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
        })

        setMessageData(
          Object.entries(dayCounts).map(([key, count]) => ({
            date: dayNames[key] || key,
            messages: count,
          }))
        )

        const hourLabels = Array.from({ length: 24 }, (_, i) => i.toString())
        setHourData(
          hourLabels.map((h) => ({
            hour: `${h}:00`,
            messages: hourCounts[h] || 0,
          }))
        )
      }

      const { data: roomMessages } = await supabase
        .from('messages')
        .select('room_id, rooms!inner(name, icon_emoji)')
        .gte('created_at', startDate)

      if (roomMessages) {
        const roomCounts: Record<string, { count: number; name: string; emoji: string }> = {}
        roomMessages.forEach((m: any) => {
          const key = m.room_id
          if (!roomCounts[key]) {
            roomCounts[key] = { count: 0, name: m.rooms.name, emoji: m.rooms.icon_emoji }
          }
          roomCounts[key].count++
        })

        setRoomData(
          Object.values(roomCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
            .map((r) => ({ name: `${r.emoji} ${r.name}`, messages: r.count }))
        )
      }

      const { data: reactions } = await supabase
        .from('reactions')
        .select('emoji')
        .gte('created_at', startDate)

      if (reactions) {
        const reactionCounts: Record<string, number> = {}
        reactions.forEach((r) => {
          reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1
        })

        setReactionData(
          Object.entries(reactionCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({ name, value }))
        )
      }

      const { count: totalMessages } = await supabase
        .from('messages').select('*', { count: 'exact', head: true })

      const { count: totalMembers } = await supabase
        .from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved')

      const { count: roomsCount } = await supabase
        .from('rooms').select('*', { count: 'exact', head: true })

      const totalDays = daysAgo || 1

      setStats({
        totalMessages: totalMessages || 0,
        totalMembers: totalMembers || 0,
        activeToday: 0,
        roomsCount: roomsCount || 0,
        avgMessagesPerDay: Math.round((totalMessages || 0) / Math.max(totalDays, 1)),
      })
    } catch (error) {
      console.error('Failed to load analytics:', error)
    }

    setLoading(false)
  }

  const REACTION_COLORS = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444']

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#A78BFA]" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium text-white">Analytics</h1>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-[14px] p-3">
          <p className="text-lg font-bold text-white">{stats.totalMessages.toLocaleString()}</p>
          <p className="text-xs text-[#56566E]">Total Messages</p>
        </div>
        <div className="glass-card rounded-[14px] p-3">
          <p className="text-lg font-bold text-white">{stats.totalMembers}</p>
          <p className="text-xs text-[#56566E]">Total Members</p>
        </div>
        <div className="glass-card rounded-[14px] p-3">
          <p className="text-lg font-bold text-white">{stats.activeToday}</p>
          <p className="text-xs text-[#56566E]">Active Today</p>
        </div>
        <div className="glass-card rounded-[14px] p-3">
          <p className="text-lg font-bold text-white">{stats.roomsCount}</p>
          <p className="text-xs text-[#56566E]">Rooms</p>
        </div>
        <div className="glass-card rounded-[14px] p-3">
          <p className="text-lg font-bold text-white">{stats.avgMessagesPerDay}</p>
          <p className="text-xs text-[#56566E]">Avg Msgs/Day</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messages per day */}
        <div className="glass-card rounded-[14px] p-4">
          <h3 className="text-sm font-medium text-white mb-4">Messages Per Day</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={messageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: textColor }} />
                <YAxis tick={{ fontSize: 11, fill: textColor }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                    backdropFilter: 'blur(20px)',
                  }}
                />
                <Line type="monotone" dataKey="messages" stroke="#A78BFA" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Peak activity hours */}
        <div className="glass-card rounded-[14px] p-4">
          <h3 className="text-sm font-medium text-white mb-4">Peak Activity Hours</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: textColor }} />
                <YAxis tick={{ fontSize: 11, fill: textColor }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                    backdropFilter: 'blur(20px)',
                  }}
                />
                <Bar dataKey="messages" fill="#A78BFA" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Most active rooms */}
        <div className="glass-card rounded-[14px] p-4">
          <h3 className="text-sm font-medium text-white mb-4">Most Active Rooms</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: textColor }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: textColor }} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                    backdropFilter: 'blur(20px)',
                  }}
                />
                <Bar dataKey="messages" fill="#7C3AED" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top reactions */}
        <div className="glass-card rounded-[14px] p-4">
          <h3 className="text-sm font-medium text-white mb-4">Top Reactions</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reactionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {reactionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={REACTION_COLORS[index % REACTION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#fff',
                    backdropFilter: 'blur(20px)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
