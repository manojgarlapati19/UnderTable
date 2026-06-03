'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Lock,
  Flame,
  Settings,
  EyeOff,
  Ghost,
  BellOff,
  Bell,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { getAvatarGradient } from '@/lib/utils/avatar-color'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
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
  const [ghostMode, setGhostMode] = useState(false)
  const [mutedRooms, setMutedRooms] = useState<Set<string>>(new Set())
  const [showPasswordGate, setShowPasswordGate] = useState(false)
  const [passwordRoom, setPasswordRoom] = useState<RoomWithUnread | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [contextMenuRoom, setContextMenuRoom] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    loadProfile()
    loadRooms()
    loadMutedRooms()
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
      setGhostMode(data.ghost_mode || false)
    }
  }

  async function loadRooms() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('name')

    if (error) {
      console.error('Failed to load rooms:', error)
      return
    }

    if (data) {
      setRooms(data)
    }
  }

  async function loadMutedRooms() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notification_preferences')
      .select('room_id, level')
      .eq('user_id', user.id)

    if (data) {
      const muted = new Set(
        data.filter((p) => p.level === 'muted').map((p) => p.room_id)
      )
      setMutedRooms(muted)
    }
  }

  async function toggleGhostMode() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return

    const newValue = !ghostMode
    const { error } = await supabase
      .from('profiles')
      .update({ ghost_mode: newValue })
      .eq('id', profile.id)

    if (!error) {
      setGhostMode(newValue)
      toast.success(newValue ? 'Ghost mode on — you are now invisible' : 'Ghost mode off')
    }
  }

  async function toggleMuteRoom(roomId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const isMuted = mutedRooms.has(roomId)
    if (isMuted) {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ level: 'all' })
        .eq('user_id', user.id)
        .eq('room_id', roomId)

      if (!error) {
        setMutedRooms((prev) => {
          const next = new Set(prev)
          next.delete(roomId)
          return next
        })
        toast.success('Room unmuted')
      }
    } else {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          room_id: roomId,
          level: 'muted',
        }, { onConflict: 'user_id, room_id' })

      if (!error) {
        setMutedRooms((prev) => new Set(prev).add(roomId))
        toast.success('Room muted')
      }
    }
    setContextMenuRoom(null)
  }

  function handleRoomClick(room: RoomWithUnread, e: React.MouseEvent) {
    if (e.button === 2) {
      e.preventDefault()
      setContextMenuRoom(room.id)
      setContextMenuPos({ x: e.clientX, y: e.clientY })
      return
    }

    // Check if room has password
    if ((room as any).room_password) {
      const hasAccess = sessionStorage.getItem(`room_access_${room.id}`)
      if (!hasAccess) {
        e.preventDefault()
        setPasswordRoom(room)
        setPasswordInput('')
        setPasswordError('')
        setShowPasswordGate(true)
        return
      }
    }

    if (isOpen) onToggle()
  }

  function handlePasswordSubmit() {
    if (!passwordRoom) return

    const correctPassword = (passwordRoom as any).room_password
    if (passwordInput === correctPassword) {
      sessionStorage.setItem(`room_access_${passwordRoom.id}`, 'true')
      setShowPasswordGate(false)
      setPasswordRoom(null)
      setPasswordInput('')
      router.push(`/chat/${passwordRoom.id}`)
      if (isOpen) onToggle()
    } else {
      setPasswordError('Incorrect passcode')
    }
  }

  // Close context menu on click outside
  useEffect(() => {
    function handleClick() {
      setContextMenuRoom(null)
    }
    if (contextMenuRoom) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenuRoom])

  const avatarGradient = profile ? getAvatarGradient(profile.anonymous_name) : 'linear-gradient(135deg, #7C3AED, #9333EA)'
  const initial = profile?.anonymous_name?.charAt(0) || '?'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#1E1B4B]/80 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar - 220px room sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-[60px] z-50 flex w-[220px] flex-col glass-panel border-r border-[rgba(255,255,255,0.08)] shrink-0 transition-transform duration-300 lg:relative lg:left-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:!translate-x-0'
        )}
      >
        {/* "Table Top Tech" Label */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-medium text-[rgba(255,255,255,0.45)] uppercase tracking-widest">
            Table Top Tech
          </p>
        </div>

        {/* Identity Card */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-3 glass-card rounded-[14px] p-3">
            <Avatar className="h-8 w-8 ring-2 ring-[#34D399]/30">
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
                <span className="h-1.5 w-1.5 rounded-full bg-[#34D399]" />
                <span className="text-[10px] text-[rgba(255,255,255,0.7)]">Online</span>
              </div>
            </div>
            <button
              onClick={toggleGhostMode}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-[8px] transition-all duration-150',
                ghostMode
                  ? 'bg-[rgba(167,139,250,0.2)] text-[#C4B5FD] shadow-glow-sm'
                  : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.1)]'
              )}
              title={ghostMode ? 'Ghost mode active' : 'Enable ghost mode'}
            >
              {ghostMode ? <Ghost className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <Separator />

        {/* Rooms Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[11px] font-medium text-[rgba(255,255,255,0.45)] uppercase tracking-wider">
            Rooms
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-[8px] text-[rgba(255,255,255,0.45)] hover:text-white" asChild>
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
              const isMuted = mutedRooms.has(room.id)
              const hasPassword = !!(room as any).room_password
              return (
                <div key={room.id} className="relative">
                  <Link
                    href={`/chat/${room.id}`}
                    onClick={(e) => handleRoomClick(room, e)}
                    onContextMenu={(e) => handleRoomClick(room, e)}
                    className={cn(
                      'flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm transition-all duration-150',
                      isActive
                        ? 'bg-[rgba(255,255,255,0.16)] text-white font-medium'
                        : 'text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
                    )}
                  >
                    <span className="text-base">{room.icon_emoji}</span>
                    <span className="flex-1 truncate">{room.name}</span>
                    <div className="flex items-center gap-1">
                      {hasPassword && <Lock className="h-3 w-3 text-[#A78BFA]" />}
                      {room.is_private && !hasPassword && <Lock className="h-3 w-3 text-[rgba(255,255,255,0.45)]" />}
                      {room.is_confession_box && <Flame className="h-3 w-3 text-orange-500" />}
                      {isMuted && <BellOff className="h-3 w-3 text-[rgba(255,255,255,0.45)]" />}
                      {!isMuted && room.unread_count ? (
                        <Badge variant="default" className="h-5 min-w-5 px-1 text-[10px]">
                          {room.unread_count}
                        </Badge>
                      ) : null}
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {/* Context menu for mute */}
        {contextMenuRoom && (
          <div
            className="fixed z-[100] rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(30,27,75,0.98)] backdrop-blur-[28px] shadow-2xl overflow-hidden py-1"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              onClick={() => toggleMuteRoom(contextMenuRoom)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-colors duration-100"
            >
              {mutedRooms.has(contextMenuRoom) ? (
                <><Bell className="h-4 w-4" /> Unmute room</>
              ) : (
                <><BellOff className="h-4 w-4" /> Mute room</>
              )}
            </button>
          </div>
        )}

        {/* Bottom section */}
        <div className="px-3 py-3 space-y-2">
          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-all duration-150"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
          <p className="text-[10px] text-[rgba(255,255,255,0.35)] text-center">
            What happens UnderTable, stays UnderTable.
          </p>
        </div>
      </aside>

      {/* Password gate dialog */}
      <Dialog open={showPasswordGate} onOpenChange={(open) => { if (!open) { setShowPasswordGate(false); setPasswordRoom(null); setPasswordInput(''); setPasswordError('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔒 This room is password protected</DialogTitle>
            <DialogDescription>
              Enter the passcode to access {passwordRoom?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSubmit() }}
              placeholder="Enter passcode"
              autoFocus
              className={cn(passwordError && 'border-red-500')}
            />
            {passwordError && (
              <p className="text-xs text-red-400">{passwordError}</p>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowPasswordGate(false); setPasswordRoom(null) }}>
                Cancel
              </Button>
              <Button onClick={handlePasswordSubmit}>
                Enter Room
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
