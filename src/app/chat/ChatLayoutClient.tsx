'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import IconRail from '@/components/layout/IconRail'
import LeftSidebar from '@/components/layout/LeftSidebar'
import RightSidebar from '@/components/layout/RightSidebar'
import SettingsModal from '@/components/layout/SettingsModal'
import { useCurrentRoomId } from '@/lib/utils/current-room'
import { Loader2, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function ChatLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const supabase = createClient()
  const currentRoomId = useCurrentRoomId()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false)
        setSidebarOpen(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        router.push('/search')
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return
        }
        e.preventDefault()
        router.push('/bookmarks')
      }
    },
    [router]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single()

      if (!profile || profile.status !== 'approved') {
        router.push('/pending')
        return
      }

      setLoading(false)
    } catch (err) {
      console.error('Auth check error:', err)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 left-3 z-50 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Icon Rail - always visible on desktop */}
        <IconRail onOpenSettings={() => setSettingsOpen(true)} />

        {/* Left Sidebar - Room sidebar */}
        <div className="flex lg:w-[224px] lg:shrink-0">
          <LeftSidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(false)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0 glass-chat">
          {children}
        </main>

        {/* Right Sidebar */}
        <RightSidebar currentRoomId={currentRoomId ?? undefined} />

        {/* Settings Modal */}
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </TooltipProvider>
  )
}
