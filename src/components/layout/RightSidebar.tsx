'use client'

import { useState, useEffect } from 'react'
import { RealtimePresenceState } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { getAvatarColor } from '@/lib/utils/avatar-color'
import { Ghost } from 'lucide-react'

interface OnlineUser {
  user_id: string
  anonymous_name: string
  avatar_color: string
  current_room: string | null
  ghost_mode: boolean
  last_seen: string
  is_idle: boolean
}

interface RightSidebarProps {
  currentRoomId?: string
}

export default function RightSidebar({ currentRoomId }: RightSidebarProps) {
  const supabase = createClient()
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  useEffect(() => {
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: 'online-users',
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: OnlineUser[] = []

        for (const key in state) {
          const presences = state[key] as any[]
          if (presences && presences.length > 0) {
            const p = presences[0]
            users.push({
              user_id: p.user_id,
              anonymous_name: p.anonymous_name,
              avatar_color: p.avatar_color,
              current_room: p.current_room,
              ghost_mode: p.ghost_mode,
              last_seen: p.last_seen || new Date().toISOString(),
              is_idle: p.is_idle || false,
            })
          }
        }

        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Get current user info
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const { data: profile } = await supabase
            .from('profiles')
            .select('anonymous_name, avatar_color, ghost_mode')
            .eq('id', user.id)
            .single()

          if (profile) {
            await channel.track({
              user_id: user.id,
              anonymous_name: profile.anonymous_name,
              avatar_color: profile.avatar_color,
              current_room: currentRoomId || null,
              ghost_mode: profile.ghost_mode,
              last_seen: new Date().toISOString(),
              is_idle: false,
            })
          }
        }
      })

    // Idle detection
    let idleTimer: NodeJS.Timeout
    const resetIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(async () => {
        await channel.track({ is_idle: true })
      }, 2 * 60 * 1000) // 2 minutes
    }

    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart']
    events.forEach((event) => window.addEventListener(event, resetIdle))
    resetIdle()

    return () => {
      channel.unsubscribe()
      events.forEach((event) => window.removeEventListener(event, resetIdle))
      clearTimeout(idleTimer)
    }
  }, [currentRoomId])

  // Filter ghost users
  const visibleUsers = onlineUsers.filter((u) => !u.ghost_mode)
  const ghostUsers = onlineUsers.filter((u) => u.ghost_mode)
  const roomUsers = visibleUsers.filter((u) => u.current_room === currentRoomId)

  return (
    <aside className="hidden xl:flex w-50 flex-col bg-sidebar border-l border-border">
      {/* Online now header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success" />
          <span className="text-sm font-semibold text-foreground">Online Now</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {visibleUsers.length}
          </Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Online users */}
          {visibleUsers.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Online</p>
              {visibleUsers.map((user) => {
                const color = getAvatarColor(user.anonymous_name)
                return (
                  <div key={user.user_id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-sidebar-hover transition-colors">
                    <div className="relative">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback style={{ backgroundColor: color }} className="text-white text-xs">
                          {user.anonymous_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar',
                          user.is_idle ? 'bg-warning' : 'bg-success'
                        )}
                      />
                    </div>
                    <span className="text-xs text-foreground truncate">{user.anonymous_name}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">No one is online</p>
            </div>
          )}

          {/* Ghost users */}
          {ghostUsers.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Incognito</p>
              {ghostUsers.map((user) => (
                <div key={user.user_id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-sidebar-hover transition-colors">
                  <div className="relative">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        <Ghost className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-muted-foreground border-2 border-sidebar" />
                  </div>
                  <span className="text-xs text-muted-foreground">Someone</span>
                </div>
              ))}
            </div>
          )}

          {/* In this room */}
          {currentRoomId && roomUsers.length > 0 && (
            <>
              <hr className="border-border" />
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">In this room</p>
                {roomUsers.map((user) => {
                  const color = getAvatarColor(user.anonymous_name)
                  return (
                    <div key={user.user_id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback style={{ backgroundColor: color }} className="text-white text-[10px]">
                          {user.anonymous_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-foreground truncate">{user.anonymous_name}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
