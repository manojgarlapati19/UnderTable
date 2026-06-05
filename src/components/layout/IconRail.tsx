'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  MessageSquare,
  Search,
  Settings,
  LogOut,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
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
    <aside
      style={{
        width: '58px',
        minWidth: '58px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '14px 0',
        gap: '10px',
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        height: '100%',
      }}
    >
      {/* Ghost Logo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '48px', width: '100%' }}>
        <Link
          href="/chat"
          style={{
            display: 'flex',
            height: '38px',
            width: '38px',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #A78BFA, #F0ABFC)',
            boxShadow: '0 4px 14px rgba(167,139,250,0.4)',
            color: '#1E1B4B',
            fontWeight: 700,
            fontSize: '18px',
          }}
        >
          U
        </Link>
      </div>

      {/* Navigation Icons */}
      <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flex: 1, padding: '0 6px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          {isInChat && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: '3px',
                height: '20px',
                background: 'linear-gradient(#A78BFA, #F0ABFC)',
                borderRadius: '2px',
              }}
            />
          )}
          <Link
            href="/chat"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
              isInChat
                ? 'bg-[rgba(167,139,250,0.16)] text-white'
                : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.7)]'
            )}
            title="Chat"
          >
            <MessageSquare className="h-5 w-5" />
          </Link>
        </div>

        <Link
          href="/search"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-[11px] transition-all duration-150',
            isActive('/search')
              ? 'bg-[rgba(167,139,250,0.16)] text-white'
              : 'text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[rgba(255,255,255,0.7)]'
          )}
          title="Search"
        >
          <Search className="h-5 w-5" />
        </Link>
      </nav>

      <Separator style={{ width: '24px', margin: '4px 0', background: 'rgba(255,255,255,0.08)' }} />

      {/* Bottom: Settings + Logout */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', paddingBottom: '12px', paddingLeft: '6px', paddingRight: '6px' }}>
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
