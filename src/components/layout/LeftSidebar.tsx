'use client'

import { useState, useEffect, useRef } from 'react'
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
  Loader2,
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
}

export default function LeftSidebar({ isOpen, onToggle, onOpenSettings }: LeftSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useRef(createClient()).current
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [rooms, setRooms] = useState<RoomWithUnread[]>([])
  const [ghostMode, setGhostMode] = useState(false)
  const [mutedRooms, setMutedRooms] = useState<Set<string>>(new Set())
  const [showPasswordGate, setShowPasswordGate] = useState(false)
  const [passwordRoom, setPasswordRoom] = useState<RoomWithUnread | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [verifyingPassword, setVerifyingPassword] = useState(false)
  const [contextMenuRoom, setContextMenuRoom] = useState<string | null>(null)
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    loadProfile().catch((err) => console.error('Failed to load profile:', err))
    loadRooms()
    loadMutedRooms().catch((err) => console.error('Failed to load muted rooms:', err))
  }, [])

  async function loadProfile() {
    try {
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
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }

  async function loadRooms() {
    try {
      // See admin/rooms/page.tsx for the rationale: try the full column list
      // first (migration 005 applied), fall back to a legacy select on
      // Postgres 42703 so the rooms list still loads on databases that
      // haven't run migration 005 yet.
      const FULL_COLUMNS =
        'id, name, description, icon_emoji, is_confession_box, has_password, created_at, slow_mode_seconds, message_ttl_hours, message_ttl_seconds'
      const LEGACY_COLUMNS =
        'id, name, description, icon_emoji, is_confession_box, created_at, slow_mode_seconds'

      let data: RoomWithUnread[] | null = null
      let error: { code?: string; message?: string } | null = null

      const first = await supabase.from('rooms').select(FULL_COLUMNS).order('name')
      if (first.error && first.error.code === '42703') {
        const second = await supabase.from('rooms').select(LEGACY_COLUMNS).order('name')
        data = (second.data as unknown as RoomWithUnread[]) ?? null
        error = second.error
      } else {
        data = (first.data as unknown as RoomWithUnread[]) ?? null
        error = first.error
      }

      if (error) {
        console.error('Failed to load rooms:', error)
        return
      }
      setRooms(data ?? [])
    } catch (err) {
      console.error('Failed to load rooms:', err)
    }
  }

  async function loadMutedRooms() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notification_preferences')
        .select('room_id, level')
        .eq('user_id', user.id)
      if (data) {
        const muted = new Set(data.filter((p) => p.level === 'muted').map((p) => p.room_id))
        setMutedRooms(muted)
      }
    } catch (err) {
      console.error('Failed to load muted rooms:', err)
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
      await supabase
        .from('notification_preferences')
        .update({ level: 'all' })
        .eq('user_id', user.id)
        .eq('room_id', roomId)
      setMutedRooms((prev) => { const next = new Set(prev); next.delete(roomId); return next })
      toast.success('Room unmuted')
    } else {
      await supabase
        .from('notification_preferences')
        .upsert({ user_id: user.id, room_id: roomId, level: 'muted' }, { onConflict: 'user_id,room_id' })
      setMutedRooms((prev) => new Set(prev).add(roomId))
      toast.success('Room muted')
    }
    setContextMenuRoom(null)
  }

  function handleRoomClick(room: RoomWithUnread, e: React.MouseEvent) {
    if (e.type === 'contextmenu') {
      e.preventDefault()
      setContextMenuRoom(room.id)
      setContextMenuPos({ x: e.clientX, y: e.clientY })
      return
    }
    if (room.has_password) {
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

  async function handlePasswordSubmit() {
    if (!passwordRoom) return
    setVerifyingPassword(true)
    setPasswordError('')

    try {
      const { data, error } = await supabase.functions.invoke('verify-room-password', {
        body: { room_id: passwordRoom.id, password: passwordInput }
      })

      if (error || !data?.valid) {
        setPasswordError(data?.error || 'Incorrect passcode')
        return
      }

      // Store a temporary access marker (session-scoped)
      sessionStorage.setItem(`room_access_${passwordRoom.id}`, 'true')
      setShowPasswordGate(false)
      router.push(`/chat/${passwordRoom.id}`)
      if (isOpen) onToggle()
    } catch {
      setPasswordError('Failed to verify passcode. Try again.')
    } finally {
      setVerifyingPassword(false)
    }
  }

  useEffect(() => {
    function handleClick() { setContextMenuRoom(null) }
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
        <div className="fixed inset-0 z-40 bg-[#1E1B4B]/80 lg:hidden" onClick={onToggle} />
      )}

      {/* ── Sidebar: inline styles for glass sidebar ── */}
      <aside
        style={{
          width: '224px',
          minWidth: '224px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Table Top Tech label */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-[10px] font-medium text-[rgba(255,255,255,0.35)] uppercase tracking-widest">
            Table Top Tech
          </p>
        </div>

        {/* Identity Card - gradient glass */}
        <div className="px-3 pb-3">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              borderRadius: '13px',
              background: 'linear-gradient(135deg, rgba(167,139,250,0.14), rgba(240,171,252,0.08))',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '12px',
            }}
          >
            <Avatar className="h-8 w-8 ring-2 ring-[#34D399]/30 shrink-0">
              <AvatarFallback style={{ background: avatarGradient }} className="text-white text-xs">
                {initial}
      </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {profile?.anonymous_name || 'Loading...'}
              </p>
              <div className="flex items-center gap-1.5">
                <span style={{ display: 'inline-block', height: '6px', width: '6px', borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px #34D399' }} />
                <span className="text-[10px] text-[rgba(255,255,255,0.7)]">Online</span>
              </div>
            </div>
            <button
              onClick={toggleGhostMode}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-[8px] transition-all duration-150 shrink-0',
                ghostMode
                  ? 'bg-[rgba(167,139,250,0.2)] text-[#C4B5FD]'
                  : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.1)]'
              )}
              title={ghostMode ? 'Ghost mode active' : 'Enable ghost mode'}
            >
              {ghostMode ? <Ghost className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <Separator style={{ background: 'rgba(255,255,255,0.08)' }} />

        {/* Rooms header */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[11px] font-medium text-[rgba(255,255,255,0.35)] uppercase tracking-wider">
            Rooms
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-[8px] text-[rgba(255,255,255,0.45)] hover:text-white"
            asChild
          >
            <Link href="/admin/rooms">
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Rooms list */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 py-1">
            {rooms.length === 0 && (
              <p className="px-3 py-2 text-xs text-[rgba(255,255,255,0.35)]">No rooms yet</p>
            )}
            {rooms.map((room) => {
              const isActive = pathname === `/chat/${room.id}`
              const isMuted = mutedRooms.has(room.id)
              const hasPassword = !!room.has_password
              return (
                <div key={room.id} className="relative">
                  <Link
                    href={`/chat/${room.id}`}
                    onClick={(e) => handleRoomClick(room, e)}
                    onContextMenu={(e) => handleRoomClick(room, e)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-sm transition-all duration-150',
                      isActive
                        ? 'bg-[rgba(255,255,255,0.1)] text-white font-semibold'
                        : 'text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
                    )}
                  >
                    <span className="text-base shrink-0">{room.icon_emoji || '#'}</span>
                    <span className="flex-1 truncate">{room.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {hasPassword && <Lock className="h-3 w-3 text-[#A78BFA]" />}
                      {room.is_confession_box && <Flame className="h-3 w-3 text-orange-400" />}
                      {isMuted && <BellOff className="h-3 w-3 text-[rgba(255,255,255,0.35)]" />}
                      {!isMuted && room.unread_count ? (
                        <Badge
                          className="h-4 min-w-4 px-1 text-[10px] font-semibold"
                          style={{
                            background: 'linear-gradient(135deg, #A78BFA, #F0ABFC)',
                            color: '#1E1B4B',
                          }}
                        >
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

        {/* Context menu */}
        {contextMenuRoom && (
          <div
            className="fixed z-[100] rounded-[12px] border border-[rgba(255,255,255,0.12)] bg-[rgba(30,27,75,0.98)] backdrop-blur-[28px] shadow-2xl py-1"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
          >
            <button
              onClick={() => toggleMuteRoom(contextMenuRoom)}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
            >
              {mutedRooms.has(contextMenuRoom)
                ? <><Bell className="h-4 w-4" /> Unmute room</>
                : <><BellOff className="h-4 w-4" /> Mute room</>
              }
            </button>
          </div>
        )}

        {/* Bottom */}
        <div className="px-3 py-3 space-y-1 border-t border-[rgba(255,255,255,0.08)]">
          <button
            onClick={onOpenSettings}
            className="flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-sm text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white transition-all duration-150"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
          <p className="text-[10px] text-[rgba(255,255,255,0.25)] text-center pt-1">
            What happens UnderTable, stays UnderTable.
          </p>
        </div>
      </aside>

      {/* Password gate */}
      <Dialog open={showPasswordGate} onOpenChange={(open) => {
        if (!open) { setShowPasswordGate(false); setPasswordRoom(null); setPasswordInput(''); setPasswordError('') }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔒 This room is password protected</DialogTitle>
            <DialogDescription>Enter the passcode to access #{passwordRoom?.name}</DialogDescription>
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
            {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowPasswordGate(false); setPasswordRoom(null) }}
                disabled={verifyingPassword}
              >
                Cancel
              </Button>
              <Button onClick={handlePasswordSubmit} disabled={verifyingPassword}>
                {verifyingPassword ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  'Enter Room'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
