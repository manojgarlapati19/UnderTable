'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Link2,
  Flag,
  Filter,
  BarChart3,
  Lightbulb,
  ArrowLeft,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/rooms', label: 'Rooms', icon: MessageSquare },
  { href: '/admin/invites', label: 'Invite Links', icon: Link2 },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/filters', label: 'Keyword Filters', icon: Filter },
  { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/admin/starters', label: 'Starters', icon: Lightbulb },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    checkAdmin()
  }, [])

  async function checkAdmin() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/chat')
      return
    }

    setIsAdmin(true)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0E0E1A]">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-[#0E0E1A]">
      {/* Top nav */}
      <div className="border-b border-[#18182A] bg-[#0B0B14]">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-12">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/chat">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Chat
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-5 bg-[#22223A]" />
            <span className="text-sm font-medium text-white">Admin Panel</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className="w-48 shrink-0 border-r border-[#18182A] min-h-[calc(100vh-48px)] bg-[#0B0B14]">
          <nav className="p-3 space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-[12px] px-3 py-2 text-sm transition-all duration-150',
                    isActive
                      ? 'bg-[#1A1530] text-white font-medium'
                      : 'text-[#8888A0] hover:bg-[#13131F] hover:text-white'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
