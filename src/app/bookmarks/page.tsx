'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bookmark, Loader2, Trash2, ArrowLeft, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getRelativeTime } from '@/lib/utils/time'
import { getAvatarColor } from '@/lib/utils/avatar-color'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from 'sonner'

interface BookmarkedMessage {
  bookmark_id: string
  bookmarked_at: string
  message: {
    id: string
    content: string
    created_at: string
    is_deleted: boolean
    is_edited: boolean
    room_id: string
  }
  room: { id: string; name: string; icon_emoji: string } | null
  author: { anonymous_name: string; avatar_color: string } | null
}

export default function BookmarksPage() {
  const router = useRouter()
  const supabase = createClient()
  const [bookmarks, setBookmarks] = useState<BookmarkedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [removingId, setRemovingId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const loadBookmarks = useCallback(async (search: string) => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const queryBuilder = supabase
        .from('bookmarks')
        .select(`
          id,
          created_at,
          messages!inner (
            id,
            content,
            created_at,
            is_deleted,
            is_edited,
            room_id
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const { data: rows, error } = await queryBuilder

      if (error) {
        console.error('Failed to load bookmarks:', error)
        toast.error('Failed to load bookmarks')
        setBookmarks([])
        return
      }

      const typedRows = (rows || []) as unknown as Array<{
        id: string
        created_at: string
        messages: {
          id: string
          content: string
          created_at: string
          is_deleted: boolean
          is_edited: boolean
          room_id: string
        } | null
      }>

      const validRows = typedRows.filter((r) => r.messages)
      const messageIds = validRows.map((r) => r.messages!.id)
      const roomIds = [...new Set(validRows.map((r) => r.messages!.room_id))]

      const [roomsRes, authorsRes] = await Promise.all([
        roomIds.length
          ? supabase.from('rooms').select('id, name, icon_emoji').in('id', roomIds)
          : Promise.resolve({ data: [] as Array<{ id: string; name: string; icon_emoji: string }> }),
        messageIds.length
          ? supabase
              .from('messages')
              .select('id, user_id')
              .in('id', messageIds)
          : Promise.resolve({ data: [] as Array<{ id: string; user_id: string }> }),
      ])

      const roomMap = new Map((roomsRes.data || []).map((r) => [r.id, r]))
      const messageUserIds = [...new Set((authorsRes.data || []).map((m) => m.user_id))]
      const { data: profiles } = messageUserIds.length
        ? await supabase
            .from('profiles')
            .select('id, anonymous_name, avatar_color')
            .in('id', messageUserIds)
        : { data: [] as Array<{ id: string; anonymous_name: string; avatar_color: string }> }
      const profileMap = new Map((profiles || []).map((p) => [p.id, p]))
      const messageToUser = new Map((authorsRes.data || []).map((m) => [m.id, m.user_id]))

      const assembled: BookmarkedMessage[] = validRows
        .filter((r) => !r.messages!.is_deleted)
        .map((r) => {
          const msg = r.messages!
          const author = profileMap.get(messageToUser.get(msg.id) || '') || null
          return {
            bookmark_id: r.id,
            bookmarked_at: r.created_at,
            message: msg,
            room: roomMap.get(msg.room_id) || null,
            author,
          }
        })

      const filtered = search.trim()
        ? assembled.filter((b) =>
            b.message.content.toLowerCase().includes(search.toLowerCase())
          )
        : assembled

      setBookmarks(filtered)
    } catch (err) {
      console.error('Bookmarks load error:', err)
      toast.error('Failed to load bookmarks')
    } finally {
      setLoading(false)
    }
  }, [router, supabase])

  useEffect(() => {
    loadBookmarks('')
  }, [loadBookmarks])

  function handleSearch(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadBookmarks(value), 300)
  }

  async function handleRemove(bookmarkId: string) {
    setRemovingId(bookmarkId)
    try {
      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('id', bookmarkId)
      if (error) throw error
      setBookmarks((prev) => prev.filter((b) => b.bookmark_id !== bookmarkId))
      toast.success('Bookmark removed')
    } catch (err) {
      console.error('Failed to remove bookmark:', err)
      toast.error('Failed to remove bookmark')
    } finally {
      setRemovingId(null)
    }
  }

  function highlightText(text: string, highlight: string) {
    if (!highlight.trim()) return text
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = text.split(regex)
    const lower = highlight.toLowerCase()
    return parts.map((part, i) =>
      part.toLowerCase() === lower ? (
        <span key={i} className="text-accent font-medium rounded px-0.5">
          {part}
        </span>
      ) : (
        part
      )
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '13px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '11px',
          flexShrink: 0,
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-[11px]"
          onClick={() => router.push('/chat')}
          title="Back to chat"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Bookmark className="h-4 w-4 text-accent" />
        <h1 className="text-sm font-medium text-white">Bookmarks</h1>
        <Badge variant="secondary" className="text-xs">
          {bookmarks.length}
        </Badge>
      </div>

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-[rgba(255,255,255,0.45)] shrink-0" />
          <Input
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search bookmarks..."
            className="flex-1 h-8 text-sm border-0 bg-transparent outline-none placeholder:text-[rgba(255,255,255,0.35)]"
            autoFocus
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-[17px] bg-primary-gradient shadow-glow-sm mb-4">
              <Bookmark className="h-7 w-7 text-white" />
            </div>
            <h3 className="text-lg font-medium text-white mb-1">
              {query ? 'No matching bookmarks' : 'No bookmarks yet'}
            </h3>
            <p className="text-sm text-[rgba(255,255,255,0.45)] max-w-xs">
              {query
                ? 'Try a different search term'
                : 'Bookmark messages to save them for later. Click the bookmark icon on any message.'}
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto p-4 space-y-3">
            {bookmarks.map((bookmark) => {
              const color = bookmark.author
                ? getAvatarColor(bookmark.author.anonymous_name)
                : '#7C3AED'
              return (
                <div
                  key={bookmark.bookmark_id}
                  className="glass-card rounded-[14px] p-4 hover:border-[rgba(255,255,255,0.2)] transition-all duration-150"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback
                        style={{ backgroundColor: color }}
                        className="text-white text-xs"
                      >
                        {bookmark.author?.anonymous_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-[#C4B5FD]">
                          {bookmark.author?.anonymous_name || 'Unknown'}
                        </span>
                        {bookmark.room && (
                          <Link
                            href={`/chat/${bookmark.room.id}#msg-${bookmark.message.id}`}
                            className="text-[10px]"
                          >
                            <Badge variant="secondary" className="text-[10px] hover:bg-[rgba(255,255,255,0.16)]">
                              {bookmark.room.icon_emoji} {bookmark.room.name}
                            </Badge>
                          </Link>
                        )}
                        <span className="text-[10px] text-[rgba(255,255,255,0.45)]">
                          {getRelativeTime(bookmark.message.created_at)}
                          {bookmark.message.is_edited && ' • edited'}
                        </span>
                      </div>
                      <Link
                        href={`/chat/${bookmark.message.room_id}#msg-${bookmark.message.id}`}
                        className="block"
                      >
                        <p className="text-sm text-white whitespace-pre-wrap break-words hover:text-accent transition-colors">
                          {highlightText(bookmark.message.content, query)}
                        </p>
                      </Link>
                      <p className="text-[10px] text-[#56566E] mt-2">
                        Bookmarked {getRelativeTime(bookmark.bookmarked_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-[8px] text-[rgba(255,255,255,0.45)] hover:text-red-400 shrink-0"
                      onClick={() => handleRemove(bookmark.bookmark_id)}
                      disabled={removingId === bookmark.bookmark_id}
                      title="Remove bookmark"
                    >
                      {removingId === bookmark.bookmark_id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
