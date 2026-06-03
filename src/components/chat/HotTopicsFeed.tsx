'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Flame } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getRelativeTime } from '@/lib/utils/time'

interface HotTopic {
  message_id: string
  room_id: string
  room_name: string
  room_emoji: string
  content: string
  reaction_count: number
  top_reactions: string[]
  created_at: string
}

export default function HotTopicsFeed() {
  const [topics, setTopics] = useState<HotTopic[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadTopics()
    const interval = setInterval(loadTopics, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function loadTopics() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: reactionCounts } = await supabase
      .from('reactions')
      .select('message_id, emoji')
      .gte('created_at', twentyFourHoursAgo)

    if (!reactionCounts) {
      setLoading(false)
      return
    }

    const countMap = new Map<string, { count: number; reactions: string[] }>()
    reactionCounts.forEach((r) => {
      const existing = countMap.get(r.message_id) || { count: 0, reactions: [] }
      existing.count++
      if (!existing.reactions.includes(r.emoji)) {
        existing.reactions.push(r.emoji)
      }
      countMap.set(r.message_id, existing)
    })

    const sorted = [...countMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)

    if (sorted.length === 0) {
      setLoading(false)
      return
    }

    const messageIds = sorted.map(([id]) => id)
    const { data: messages } = await supabase
      .from('messages')
      .select('id, content, room_id, created_at, rooms!inner(name, icon_emoji)')
      .in('id', messageIds)

    if (messages) {
      const hotTopics: HotTopic[] = messages.map((m) => {
        const stats = countMap.get(m.id) || { count: 0, reactions: [] }
        return {
          message_id: m.id,
          room_id: m.room_id,
          room_name: (m.rooms as any).name,
          room_emoji: (m.rooms as any).icon_emoji,
          content: m.content,
          reaction_count: stats.count,
          top_reactions: stats.reactions.slice(0, 3),
          created_at: m.created_at,
        }
      })
      setTopics(hotTopics)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 skeleton rounded-[8px]" />
            <div className="h-4 w-full skeleton rounded-[8px]" />
          </div>
        ))}
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Flame className="h-8 w-8 text-[#56566E] mb-2" />
        <p className="text-sm text-[rgba(255,255,255,0.45)]">No hot topics in the last 24 hours</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="h-5 w-5 text-orange-500" />
        <h2 className="text-sm font-medium text-white">Hot Topics</h2>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-3">
          {topics.map((topic, index) => (
            <a
              key={topic.message_id}
              href={`/chat/${topic.room_id}#msg-${topic.message_id}`}
              
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-[10px]">
                  #{index + 1}
                </Badge>
                <span className="text-xs text-[rgba(255,255,255,0.45)]">
                  {topic.room_emoji} {topic.room_name}
                </span>
                <span className="text-[10px] text-[#56566E] ml-auto">
                  {getRelativeTime(topic.created_at)}
                </span>
              </div>
              <p className="text-sm text-white line-clamp-2 group-hover:text-[#A78BFA] transition-colors duration-150">
                {topic.content}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-[rgba(255,255,255,0.45)]">
                  🔥 {topic.reaction_count} reactions
                </span>
                <span className="text-xs">{topic.top_reactions.join(' ')}</span>
              </div>
            </a>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
