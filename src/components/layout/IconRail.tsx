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
    <aside className="flex w-16 flex-col items-center bg-[#0B0B14] border-r border-[#18182A] shrink-0">
      {/* Ghost Logo */}
      <div className="flex items-center justify-center h-16 w-full">
        <Link href="/chat" className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-accent-gradient shadow-lg shadow-purple-500/30">
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
              ? 'bg-[#1A1530] text-[#A855F7]'
              : 'text-[#56566E] hover:bg-[#13131F] hover:text-[#8888A0]'
          )}
          title="Chat"
        >
          <MessageSquare className="h-5 w-5" />
        </Link>
        <Link
          href="/chat"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
            pathname === '/chat'
              ? 'bg-[#1A1530] text-[#A855F7]'
              : 'text-[#56566E] hover:bg-[#13131F] hover:text-[#8888A0]'
          )}
          title="Hot Topics"
        >
          <Flame className="h-5 w-5" />
        </Link>
        <Link
          href="/chat"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
            pathname === '/chat'
              ? 'bg-[#1A1530] text-[#A855F7]'
              : 'text-[#56566E] hover:bg-[#13131F] hover:text-[#8888A0]'
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
              ? 'bg-[#1A1530] text-[#A855F7]'
              : 'text-[#56566E] hover:bg-[#13131F] hover:text-[#8888A0]'
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
              ? 'bg-[#1A1530] text-[#A855F7]'
              : 'text-[#56566E] hover:bg-[#13131F] hover:text-[#8888A0]'
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
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[#56566E] hover:bg-[#13131F] hover:text-[#8888A0] transition-all duration-150"
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          onClick={handleLogout}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-[#56566E] hover:bg-[#13131F] hover:text-red-400 transition-all duration-150"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </aside>
  )
}
