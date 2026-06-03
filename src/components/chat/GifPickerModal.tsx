'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface GifPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (gifUrl: string) => void
}

export default function GifPickerModal({ open, onOpenChange, onSelect }: GifPickerModalProps) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedGif, setSelectedGif] = useState<string | null>(null)

  async function searchGifs() {
    if (!query.trim()) return
    setLoading(true)

    try {
      const res = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${process.env.NEXT_PUBLIC_TENOR_API_KEY}&limit=20`
      )
      const data = await res.json()
      setGifs(data.results || [])
    } catch (error) {
      console.error('Failed to search GIFs:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(gifUrl: string) {
    setSelectedGif(gifUrl)
    onSelect(gifUrl)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select a GIF</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchGifs()}
              placeholder="Search GIFs..."
            />
            <Button onClick={searchGifs} disabled={loading} className="shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-[rgba(255,255,255,0.45)]" />
              </div>
            ) : gifs.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif: any) => (
                  <button
                    key={gif.id}
                    onClick={() => handleSelect(gif.media_formats?.gif?.url || gif.url)}
                    className="rounded-[12px] overflow-hidden border border-[rgba(255,255,255,0.12)] hover:border-[#C4B5FD] transition-colors duration-150"
                  >
                    <img
                      src={gif.media_formats?.tinygif?.url || gif.media_formats?.gif?.url}
                      alt="GIF"
                      className="w-full h-40 object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-[#56566E]">
                {query ? 'No results found' : 'Search for GIFs above'}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
