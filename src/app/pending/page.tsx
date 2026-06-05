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
    let interval: ReturnType<typeof setInterval>

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

      interval = setInterval(async () => {
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
    }

    checkStatus()
    return () => { if (interval) clearInterval(interval) }
  }, [router, supabase])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(120% 80% at 100% 0%, rgba(219,39,119,0.22) 0%, transparent 50%), radial-gradient(110% 90% at 0% 100%, rgba(8,145,178,0.22) 0%, transparent 55%), linear-gradient(160deg, #14122B 0%, #0C0B1C 100%)' }}>
        <Loader2 className="h-8 w-8 animate-spin text-[#A78BFA]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center glass-auth space-y-6">
        <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[18px] ghost-glow">
          <span className="text-3xl text-[#1E1B4B]">👻</span>
        </div>
        <div>
          <h1 className="text-[26px] font-semibold text-white">
            You&apos;re on the list!
          </h1>
          <p className="text-[13px] text-[rgba(255,255,255,0.6)] mt-1">
            An admin will approve your account shortly. Please check back soon.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-[rgba(255,255,255,0.45)]">
          <Loader2 className="h-4 w-4 animate-spin text-[#A78BFA]" />
          Waiting for approval...
        </div>
      </div>
    </div>
  )
}
