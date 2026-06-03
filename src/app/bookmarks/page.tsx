'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Bookmark, Trash2, Loader2, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getRelativeTime } from '@/lib/utils/time'
import { toast } from 'sonner'

interface BookmarkWithMessage {
  id: string
  message_id: string
  created_at: string
  messages: {
    content: string
    room_id: string
    created_at: string
    rooms: { name: string; icon_emoji: string }
  }
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkWithMessage[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadBookmarks()
  }, [])

  async function loadBookmarks() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('bookmarks')
      .select(`
        id,
        message_id,
        created_at,
        messages!inner(
          content,
          room_id,
          created_at,
          rooms!inner(name, icon_emoji)
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setBookmarks(data as BookmarkWithMessage[])
    setLoading(false)
  }

  async function removeBookmark(bookmarkId: string) {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', bookmarkId)

    if (!error) {
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
      toast.success('Bookmark removed')
    }
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/chat">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-[26px] font-medium text-white">Bookmarks</h1>
            <p className="text-sm text-[rgba(255,255,255,0.7)]">Your saved messages</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[#A78BFA]" />
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="text-center py-12">
            <Bookmark className="h-12 w-12 text-[rgba(255,255,255,0.45)] mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-white mb-1">No bookmarks yet</h3>
            <p className="text-sm text-[rgba(255,255,255,0.45)]">
              Hover over a message and click the bookmark icon to save it here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookmarks.map((bookmark) => (
              <div
                key={bookmark.id}
                className="glass-card rounded-[14px] p-4 hover:border-[rgba(255,255,255,0.2)] transition-all duration-150"
              >
                <div className="flex items-start justify-between gap-4">
                  <Link
                    href={`/chat/${bookmark.messages.room_id}#msg-${bookmark.message_id}`}
                    className="flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {bookmark.messages.rooms.icon_emoji} {bookmark.messages.rooms.name}
                      </Badge>
                      <span className="text-[10px] text-[rgba(255,255,255,0.45)]">
                        {getRelativeTime(bookmark.messages.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-white line-clamp-2">
                      {bookmark.messages.content}
                    </p>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-[#56566E] hover:text-red-400"
                    onClick={() => removeBookmark(bookmark.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
