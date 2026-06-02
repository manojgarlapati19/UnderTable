'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Lock,
  Flame,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { getAvatarGradient } from '@/lib/utils/avatar-color'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import type { Tables } from '@/lib/supabase/database.types'

interface LeftSidebarProps {
  isOpen: boolean
  onToggle: () => void
  onOpenSettings?: () => void
}

interface RoomWithUnread extends Tables<'rooms'> {
  unread_count?: number
  online_count?: number
}

export default function LeftSidebar({ isOpen, onToggle, onOpenSettings }: LeftSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [rooms, setRooms] = useState<RoomWithUnread[]>([])

  useEffect(() => {
    loadProfile()
    loadRooms()
  }, [])

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) {
      setProfile(data)
    }
  }

  async function loadRooms() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    console.log('[LeftSidebar] Fetching rooms...')
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('name')

    console.log('[LeftSidebar] Rooms result:', data, error)

    if (data) {
      setRooms(data)
    }
  }

  const avatarGradient = profile ? getAvatarGradient(profile.anonymous_name) : 'linear-gradient(135deg, #7C3AED, #9333EA)'
  const initial = profile?.anonymous_name?.charAt(0) || '?'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#07070D]/80 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar - 220px room sidebar */}
      {/* Desktop: always visible in-flow. Mobile: overlay drawer sliding from left */}
      <aside
        className={cn(
          'fixed inset-y-0 left-16 z-50 flex w-[220px] flex-col bg-[#0B0B14] border-r border-[#18182A] shrink-0 transition-transform duration-300 lg:relative lg:left-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:!translate-x-0'
        )}
      >
        {/* "Table Top Tech" Label */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-medium text-[#4A4A60] uppercase tracking-widest">
            Table Top Tech
          </p>
        </div>

        {/* Identity Card */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-3 rounded-[16px] bg-[#13131F] p-3 border border-[#22223A]">
            <Avatar className="h-8 w-8 ring-2 ring-[#22C55E]/30">
              <AvatarFallback
                style={{ background: avatarGradient }}
                className="text-white text-xs"
              >
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {profile?.anonymous_name || 'Loading...'}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />
                <span className="text-[10px] text-[#8888A0]">Online</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Rooms Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[11px] font-medium text-[#56566E] uppercase tracking-wider">
            Rooms
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-[8px] text-[#56566E] hover:text-white" asChild>
            <Link href="/admin/rooms">
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Rooms List */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 py-1">
            {rooms.map((room) => {
              const currentRoomId = pathname.split('/chat/')[1]
              const isActive = currentRoomId === room.id || pathname === `/chat/${room.id}`
              return (
                <Link
                  key={room.id}
                  href={`/chat/${room.id}`}
                  onClick={() => onToggle()}
                  className={cn(
                    'flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm transition-all duration-150',
                    isActive
                      ? 'bg-[#1A1530] text-white font-medium'
                      : 'text-[#8888A0] hover:bg-[#13131F] hover:text-white'
                  )}
                >
                  <span className="text-base">{room.icon_emoji}</span>
                  <span className="flex-1 truncate">{room.name}</span>
                  <div className="flex items-center gap-1">
                    {room.is_private && <Lock className="h-3 w-3 text-[#56566E]" />}
                    {room.is_confession_box && <Flame className="h-3 w-3 text-orange-500" />}
                    {room.unread_count ? (
                      <Badge variant="default" className="h-5 min-w-5 px-1 text-[10px]">
                        {room.unread_count}
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
        </ScrollArea>

        {/* Bottom hint */}
        <div className="px-4 py-3">
          <p className="text-[10px] text-[#4A4A60] text-center">
            What happens UnderTable, stays UnderTable.
          </p>
        </div>
      </aside>
    </>
  )
}
