'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function PendingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkStatus = async () => {
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

      if (profile?.status === 'approved') {
        router.push('/chat')
        return
      }

      if (profile?.status === 'banned') {
        router.push('/login?error=banned')
        return
      }

      setChecking(false)

      // Poll for status change every 10 seconds
      const interval = setInterval(async () => {
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .select('status')
          .eq('id', user.id)
          .single()

        if (updatedProfile?.status === 'approved') {
          clearInterval(interval)
          router.push('/chat')
        }
      }, 10000)

      return () => clearInterval(interval)
    }

    checkStatus()
  }, [router, supabase])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-4">
        <div className="text-6xl mb-6">👻</div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          You're on the list!
        </h1>
        <p className="text-muted-foreground mb-6">
          An admin will approve your account shortly. Please check back soon.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for approval...
        </div>
      </div>
    </div>
  )
}
