'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare,
  Flame,
  Trophy,
  Bookmark,
  Search,
  Settings,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

interface IconRailProps {
  onOpenSettings?: () => void
}

export default function IconRail({ onOpenSettings }: IconRailProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const isInChat = pathname === '/chat' || pathname.startsWith('/chat/')

  const isActive = (href: string) => {
    if (href === '/chat') return isInChat
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex w-[60px] flex-col items-center glass-panel border-r border-[rgba(255,255,255,0.08)] shrink-0">
      {/* Ghost Logo */}
      <div className="flex items-center justify-center h-16 w-full">
        <Link href="/chat" className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary-gradient shadow-glow-sm text-[#2E1065] font-bold">
          <span className="text-base font-bold text-white">U</span>
        </Link>
      </div>

      {/* Navigation Icons */}
      <nav className="flex flex-col items-center gap-1 flex-1 px-3 pt-2">
        <Link
          href="/chat"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
            isInChat
              ? 'bg-[rgba(255,255,255,0.18)] text-white'
              : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.7)]'
          )}
          title="Chat"
        >
          <MessageSquare className="h-5 w-5" />
        </Link>
        <Link
          href="/chat?view=hot"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
            pathname === '/chat'
              ? 'bg-[rgba(255,255,255,0.18)] text-white'
              : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.7)]'
          )}
          title="Hot Topics"
        >
          <Flame className="h-5 w-5" />
        </Link>
        <Link
          href="/chat?view=leaderboard"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
            pathname === '/chat'
              ? 'bg-[rgba(255,255,255,0.18)] text-white'
              : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.7)]'
          )}
          title="Leaderboard"
        >
          <Trophy className="h-5 w-5" />
        </Link>
        <Link
          href="/bookmarks"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
            isActive('/bookmarks')
              ? 'bg-[rgba(255,255,255,0.18)] text-white'
              : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.7)]'
          )}
          title="Bookmarks"
        >
          <Bookmark className="h-5 w-5" />
        </Link>
        <Link
          href="/search"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
            isActive('/search')
              ? 'bg-[rgba(255,255,255,0.18)] text-white'
              : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.7)]'
          )}
          title="Search"
        >
          <Search className="h-5 w-5" />
        </Link>
      </nav>

      {/* Bottom: Settings + Logout */}
      <div className="flex flex-col items-center gap-1 pb-4 px-3">
        <button
          onClick={onOpenSettings}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.7)] transition-all duration-150"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-red-400 transition-all duration-150"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </aside>
  )
}
