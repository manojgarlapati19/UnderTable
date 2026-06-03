'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Flame, Trophy } from 'lucide-react'
import HotTopicsFeed from '@/components/chat/HotTopicsFeed'
import ReactionLeaderboard from '@/components/chat/ReactionLeaderboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function ChatIndexContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get('view')
  const supabase = createClient()
  const [redirecting, setRedirecting] = useState(false)
  const [noRooms, setNoRooms] = useState(false)

  useEffect(() => {
    // If a specific view is requested, don't redirect
    if (viewParam === 'hot' || viewParam === 'leaderboard') return

    setRedirecting(true)
    supabase
      .from('rooms')
      .select('id')
      .order('name')
      .limit(1)
      .then(({ data: rooms }) => {
        if (rooms && rooms.length > 0) {
          router.replace(`/chat/${rooms[0].id}`)
        } else {
          setNoRooms(true)
          setRedirecting(false)
        }
      })
  }, [viewParam])

  const activeTab = viewParam === 'leaderboard' ? 'leaderboard' : 'hot'

  if (viewParam === 'hot' || viewParam === 'leaderboard' || noRooms) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">
          {noRooms && (
            <p className="text-sm text-[rgba(255,255,255,0.45)] text-center mb-4">
              No rooms available yet. Check back soon!
            </p>
          )}
          <Tabs
            value={activeTab}
            onValueChange={(v) => router.push(`/chat?view=${v}`)}
          >
            <TabsList className="w-full">
              <TabsTrigger value="hot" className="flex-1">
                <Flame className="h-4 w-4 mr-1" /> Hot Topics
              </TabsTrigger>
              <TabsTrigger value="leaderboard" className="flex-1">
                <Trophy className="h-4 w-4 mr-1" /> Leaderboard
              </TabsTrigger>
            </TabsList>
            <TabsContent value="hot">
              <HotTopicsFeed />
            </TabsContent>
            <TabsContent value="leaderboard">
              <ReactionLeaderboard />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  )
}

export default function ChatIndexPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    }>
      <ChatIndexContent />
    </Suspense>
  )
}
