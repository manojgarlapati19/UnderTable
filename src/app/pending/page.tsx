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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#A78BFA]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-sm glass-auth p-8 shadow-2xl">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-[17px] ghost-glow mb-6">
          <span className="text-3xl font-bold text-[#2E1065]">U</span>
        </div>
        <h1 className="text-[26px] font-medium text-white mb-2">
          You&apos;re on the list!
        </h1>
        <p className="text-[rgba(255,255,255,0.7)] mb-6">
          An admin will approve your account shortly. Please check back soon.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-[rgba(255,255,255,0.45)]">
          <Loader2 className="h-4 w-4 animate-spin text-[#A78BFA]" />
          Waiting for approval...
        </div>
      </div>
    </div>
  )
}
