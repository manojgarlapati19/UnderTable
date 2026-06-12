'use client'

import { usePresence } from '@/hooks/usePresence'
import { cn } from '@/lib/utils/cn'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { getAvatarColor } from '@/lib/utils/avatar-color'
import { Ghost } from 'lucide-react'

interface RightSidebarProps {
  currentRoomId?: string
}

export default function RightSidebar({ currentRoomId }: RightSidebarProps) {
  const { visibleUsers } = usePresence()

  const onlineUsers = visibleUsers.filter((u) => !u.ghost_mode)
  const ghostUsers = visibleUsers.filter((u) => u.ghost_mode)
  const roomUsers = onlineUsers.filter((u) => u.current_room === currentRoomId)

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
            {onlineUsers.length}
          </Badge>
        </div>
      </div>

      <ScrollArea style={{ flex: 1 }}>
        <div style={{ padding: '12px' }}>
          {onlineUsers.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-[rgba(255,255,255,0.35)] uppercase tracking-wider">Online</p>
              {onlineUsers.map((user) => {
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
