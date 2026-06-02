'use client'

import { Users, MessageSquare, Flag, Activity, Clock, Hash } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface StatsCardsProps {
  stats: {
    totalMembers: number
    pendingApprovals: number
    activeToday: number
    messagesToday: number
    flaggedMessages: number
    roomsCount: number
  }
}

const cards = [
  { label: 'Total Members', value: 'totalMembers', icon: Users, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950' },
  { label: 'Pending Approvals', value: 'pendingApprovals', icon: Clock, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950' },
  { label: 'Active Today', value: 'activeToday', icon: Activity, color: 'text-green-500 bg-green-50 dark:bg-green-950' },
  { label: 'Messages Today', value: 'messagesToday', icon: MessageSquare, color: 'text-violet-500 bg-violet-50 dark:bg-violet-950' },
  { label: 'Flagged Messages', value: 'flaggedMessages', icon: Flag, color: 'text-red-500 bg-red-50 dark:bg-red-950' },
  { label: 'Rooms', value: 'roomsCount', icon: Hash, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950' },
]

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div key={card.value} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-lg p-2', card.color)}>
              <card.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {stats[card.value as keyof typeof stats]}
              </p>
              <p className="text-[10px] text-muted-foreground">{card.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
