'use client'

import { useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Search, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getRelativeTime } from '@/lib/utils/time'

interface SearchResult {
  id: string
  content: string
  room_id: string
  created_at: string
  rooms: { name: string; icon_emoji: string }
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>()
  const supabase = createClient()

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([])
        setSearched(false)
        return
      }

      setLoading(true)
      setSearched(true)

      try {
        // Use ILIKE for simple search (full-text search would require postgres extension)
        const { data } = await supabase
          .from('messages')
          .select(`
            id,
            content,
            room_id,
            created_at,
            rooms!inner(name, icon_emoji)
          `)
          .ilike('content', `%${searchQuery}%`)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(50)

        if (data) setResults(data as SearchResult[])
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    },
    [supabase]
  )

  function handleInput(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => performSearch(value), 500)
  }

  function highlightText(text: string, highlight: string) {
    if (!highlight.trim()) return text
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="bg-primary/20 text-primary font-medium rounded px-0.5">
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/chat">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => handleInput(e.target.value)}
                placeholder="Search messages... (Ctrl+K)"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : searched && results.length === 0 ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No results found</h3>
            <p className="text-sm text-muted-foreground">
              No messages match your search query
            </p>
          </div>
        ) : !searched ? (
          <div className="text-center py-12">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">Search messages</h3>
            <p className="text-sm text-muted-foreground">
              Type to search across all rooms
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>

            {/* Group by room */}
            {Object.entries(
              results.reduce<Record<string, SearchResult[]>>((groups, result) => {
                const key = result.room_id
                if (!groups[key]) groups[key] = []
                groups[key].push(result)
                return groups
              }, {})
            ).map(([roomId, roomResults]) => (
              <div key={roomId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {roomResults[0].rooms.icon_emoji} {roomResults[0].rooms.name}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {roomResults.length} message{roomResults.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {roomResults.map((result) => (
                  <Link
                    key={result.id}
                    href={`/chat/${result.room_id}#msg-${result.id}`}
                    className="block rounded-lg border border-border p-3 hover:border-primary/30 transition-colors"
                  >
                    <p className="text-sm text-foreground line-clamp-3 mb-1">
                      {highlightText(result.content, query)}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {getRelativeTime(result.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
