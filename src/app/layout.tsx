'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import IconRail from '@/components/layout/IconRail'
import LeftSidebar from '@/components/layout/LeftSidebar'
import RightSidebar from '@/components/layout/RightSidebar'
import SettingsModal from '@/components/layout/SettingsModal'
import { Loader2, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { setSettingsOpen(false); setSidebarOpen(false) }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); router.push('/search') }
  }, [router])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', user.id)
      .single()

    if (!profile || profile.status !== 'approved') { router.push('/pending'); return }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#A78BFA]" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      {/* Root: full screen, flex row, no overflow */}
      <div className="flex h-screen w-screen overflow-hidden">

        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 left-3 z-50 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5 text-white" />
        </Button>

        {/* 1. Icon Rail — 60px, always visible */}
        <IconRail onOpenSettings={() => setSettingsOpen(true)} />

        {/* 2. Rooms Sidebar — 220px on desktop, drawer on mobile */}
        <LeftSidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(false)}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* 3. Main chat area — fills remaining space */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[rgba(255,255,255,0.02)] backdrop-blur-[8px]">
          {children}
        </main>

        {/* 4. Right sidebar — online members */}
        <RightSidebar />

        {/* Settings Modal */}
        <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </TooltipProvider>
  )
}