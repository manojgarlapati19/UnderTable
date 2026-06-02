'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Flame, Trophy } from 'lucide-react'
import HotTopicsFeed from '@/components/chat/HotTopicsFeed'
import ReactionLeaderboard from '@/components/chat/ReactionLeaderboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ChatIndexPage() {
  const router = useRouter()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)
  const [showFeed, setShowFeed] = useState(false)
  const [tab, setTab] = useState('rooms')

  useEffect(() => {
    loadRooms()
  }, [])

  async function loadRooms() {
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id')
      .order('name')
      .limit(1)

    if (rooms && rooms.length > 0) {
      router.push(`/chat/${rooms[0].id}`)
    } else {
      setError('No rooms available. Please contact an admin.')
      setShowFeed(true)
    }
  }

  if (error && showFeed) {
    return (
      <div className="flex-1 overflow-y-auto bg-[#0E0E1A]">
        <div className="max-w-2xl mx-auto p-6">
          <Tabs value={tab} onValueChange={setTab}>
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
    <div className="flex-1 flex items-center justify-center bg-[#0E0E1A]">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  )
}
