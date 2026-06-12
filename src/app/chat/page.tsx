'use client'

import { useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

function ChatIndexContent() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('rooms')
      .select('id')
      .order('name')
      .limit(1)
      .then(({ data: rooms }) => {
        if (rooms && rooms.length > 0) {
          router.replace(`/chat/${rooms[0].id}`)
        }
      })
  }, [])

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
