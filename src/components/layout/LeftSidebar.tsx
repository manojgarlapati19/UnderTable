'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare,
  Plus,
  Search,
  Bookmark,
  Settings,
  LogOut,
  Moon,
  Sun,
  Ghost,
  Lock,
  Flame,
  Trophy,
  Home,
  Menu,
  Eye,
  EyeOff,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import { getAvatarColor, getAvatarBgColor } from '@/lib/utils/avatar-color'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useTheme } from 'next-themes'
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
  const { theme, setTheme } = useTheme()
  const supabase = createClient()
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [rooms, setRooms] = useState<RoomWithUnread[]>([])
  const [isAdmin, setIsAdmin] = useState(false)

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
      setIsAdmin(data.role === 'admin')
    }
  }

  async function loadRooms() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('rooms')
      .select('*')
      .order('name')

    if (data) {
      setRooms(data)
    }
  }

  async function toggleGhostMode() {
    if (!profile) return
    const { error } = await supabase
      .from('profiles')
      .update({ ghost_mode: !profile.ghost_mode })
      .eq('id', profile.id)

    if (!error) {
      setProfile({ ...profile, ghost_mode: !profile.ghost_mode })
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const avatarColor = profile ? getAvatarColor(profile.anonymous_name) : '#7C3AED'
  const initial = profile?.anonymous_name?.charAt(0) || '?'

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-sidebar border-r border-border transition-transform duration-300 lg:relative lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-lg">👻</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">UnderTable</h1>
            <p className="text-[10px] text-muted-foreground">Table Top Tech</p>
          </div>
        </div>

        <Separator />

        {/* Identity Card */}
        <div className="px-3 py-3">
          <div className="flex items-center gap-3 rounded-lg bg-card p-2 border border-border">
            <Avatar className="h-8 w-8">
              <AvatarFallback style={{ backgroundColor: avatarColor }} className="text-white text-xs">
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {profile?.anonymous_name || 'Loading...'}
              </p>
              <p className="text-[10px] text-muted-foreground">You are</p>
            </div>
            <button
              onClick={toggleGhostMode}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                profile?.ghost_mode
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-sidebar-hover'
              )}
              title={profile?.ghost_mode ? 'Ghost mode active' : 'Toggle ghost mode'}
            >
              {profile?.ghost_mode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <Separator />

        {/* Rooms Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Rooms
          </span>
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
              <Link href="/admin/rooms">
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>

        {/* Rooms List */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 py-1">
            {rooms.map((room) => {
              const isActive = pathname === `/chat/${room.id}`
              return (
                <Link
                  key={room.id}
                  href={`/chat/${room.id}`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-sidebar-active text-primary font-medium'
                      : 'text-foreground hover:bg-sidebar-hover'
                  )}
                >
                  <span className="text-base">{room.icon_emoji}</span>
                  <span className="flex-1 truncate">{room.name}</span>
                  <div className="flex items-center gap-1">
                    {room.is_private && <Lock className="h-3 w-3 text-muted-foreground" />}
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

        <Separator />

        {/* Bottom Controls */}
        <div className="p-2 space-y-1">
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" asChild>
            <Link href="/search">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" asChild>
            <Link href="/bookmarks">
              <Bookmark className="h-4 w-4 mr-2" />
              Bookmarks
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" asChild>
            <Link href="/chat">
              <Flame className="h-4 w-4 mr-2" />
              Hot Topics
            </Link>
          </Button>
          {isAdmin && (
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" asChild>
              <Link href="/admin">
                <Settings className="h-4 w-4 mr-2" />
                Admin Panel
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>
    </>
  )
}
