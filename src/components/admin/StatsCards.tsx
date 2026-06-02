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
  { label: 'Total Members', value: 'totalMembers' as const, icon: Users, color: 'text-blue-400 bg-blue-500/10' },
  { label: 'Pending Approvals', value: 'pendingApprovals' as const, icon: Clock, color: 'text-amber-400 bg-amber-500/10' },
  { label: 'Active Today', value: 'activeToday' as const, icon: Activity, color: 'text-green-400 bg-green-500/10' },
  { label: 'Messages Today', value: 'messagesToday' as const, icon: MessageSquare, color: 'text-violet-400 bg-violet-500/10' },
  { label: 'Flagged Messages', value: 'flaggedMessages' as const, icon: Flag, color: 'text-red-400 bg-red-500/10' },
  { label: 'Rooms', value: 'roomsCount' as const, icon: Hash, color: 'text-cyan-400 bg-cyan-500/10' },
]

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div key={card.value} className="rounded-[16px] border border-[#22223A] bg-[#13131F] p-4 hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-[12px] p-2', card.color)}>
              <card.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {stats[card.value]}
              </p>
              <p className="text-[10px] text-[#56566E]">{card.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
