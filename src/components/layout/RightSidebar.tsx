'use client'

import { useState, useEffect } from 'react'
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
      config: { presence: { key: 'online-users' } },
    })

    let idleTimer: NodeJS.Timeout
    let trackedState: Record<string, any> = {}

    const resetIdle = () => {
      clearTimeout(idleTimer)
      idleTimer = setTimeout(async () => {
        if (Object.keys(trackedState).length > 0) {
          await channel.track({ ...trackedState, is_idle: true })
        }
      }, 2 * 60 * 1000)
    }

    const handleActivity = () => {
      if (Object.keys(trackedState).length > 0) {
        channel.track({ ...trackedState, is_idle: false, last_seen: new Date().toISOString() })
      }
      resetIdle()
    }

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
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const { data: profile } = await supabase
            .from('profiles')
            .select('anonymous_name, avatar_color, ghost_mode')
            .eq('id', user.id)
            .single()

          if (profile) {
            trackedState = {
              user_id: user.id,
              anonymous_name: profile.anonymous_name,
              avatar_color: profile.avatar_color,
              current_room: currentRoomId || null,
              ghost_mode: profile.ghost_mode,
              last_seen: new Date().toISOString(),
              is_idle: false,
            }
            await channel.track(trackedState)
            resetIdle()
          }
        }
      })

    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart']
    events.forEach((event) => window.addEventListener(event, handleActivity))

    return () => {
      channel.unsubscribe()
      events.forEach((event) => window.removeEventListener(event, handleActivity))
      clearTimeout(idleTimer)
    }
  }, [currentRoomId])

  const visibleUsers = onlineUsers.filter((u) => !u.ghost_mode)
  const ghostUsers = onlineUsers.filter((u) => u.ghost_mode)
  const roomUsers = visibleUsers.filter((u) => u.current_room === currentRoomId)

  return (
    <aside
      style={{
        width: '200px',
        minWidth: '200px',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Online now header */}
      <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-block', height: '8px', width: '8px', borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px #34D399' }} />
          <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>Online Now</span>
          <Badge variant="secondary" style={{ marginLeft: 'auto', fontSize: '10px' }}>
            {visibleUsers.length}
          </Badge>
        </div>
      </div>

      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: '12px' }}>
          {visibleUsers.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-[rgba(255,255,255,0.35)] uppercase tracking-wider">Online</p>
              {visibleUsers.map((user) => {
                const color = getAvatarColor(user.anonymous_name)
                return (
                  <div
                    key={user.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      borderRadius: '11px',
                      padding: '6px 8px',
                      transition: 'background 0.15s',
                    }}
                    className="hover:bg-[rgba(255,255,255,0.04)]"
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar className="h-7 w-7">
                        <AvatarFallback style={{ backgroundColor: color }} className="text-white text-xs">
                          {user.anonymous_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={cn(
                          'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[rgba(255,255,255,0.05)]',
                          user.is_idle ? 'bg-[#F59E0B]' : 'bg-[#34D399]'
                        )}
                        style={user.is_idle ? { boxShadow: '0 0 6px #F59E0B' } : { boxShadow: '0 0 6px #34D399' }}
                      />
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.anonymous_name}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>No one is online</p>
            </div>
          )}

          {ghostUsers.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-[rgba(255,255,255,0.35)] uppercase tracking-wider">Incognito</p>
              {ghostUsers.map((user) => (
                <div
                  key={user.user_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    borderRadius: '11px',
                    padding: '6px 8px',
                    transition: 'background 0.15s',
                  }}
                  className="hover:bg-[rgba(255,255,255,0.04)]"
                >
                  <div style={{ position: 'relative' }}>
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.45)]">
                        <Ghost className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', height: '10px', width: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.35)', border: '2px solid rgba(255,255,255,0.05)' }} />
                  </div>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>Someone</span>
                </div>
              ))}
            </div>
          )}

          {currentRoomId && roomUsers.length > 0 && (
            <>
              <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
              <div className="space-y-1">
                <p className="text-[10px] font-medium text-[rgba(255,255,255,0.35)] uppercase tracking-wider">In this room</p>
                {roomUsers.map((user) => {
                  const color = getAvatarColor(user.anonymous_name)
                  return (
                    <div
                      key={user.user_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        borderRadius: '11px',
                        padding: '6px 8px',
                      }}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback style={{ backgroundColor: color }} className="text-white text-[10px]">
                          {user.anonymous_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.anonymous_name}
                      </span>
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
