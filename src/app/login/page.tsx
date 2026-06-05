'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(errorParam === 'banned' ? 'Your account has been banned' : '')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) throw signInError

      router.push('/chat')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid email or password'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-auth space-y-6">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[18px] ghost-glow">
            <span className="text-3xl text-[#1E1B4B]">👻</span>
          </div>
          <div>
            <h1 className="text-[26px] font-semibold text-white">UnderTable</h1>
            <p className="text-[13px] text-[rgba(255,255,255,0.6)] mt-1">
              What happens UnderTable, stays UnderTable.
            </p>
            <p className="text-[11px] text-[rgba(255,255,255,0.35)]">Table Top Tech</p>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 rounded-[13px] bg-red-500/10 p-3 text-sm text-red-400 border border-red-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[12px] text-[rgba(255,255,255,0.7)]">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="h-[46px] px-[14px] text-[13px] text-white placeholder:text-[rgba(255,255,255,0.35)] focus-visible:border-[rgba(167,139,250,0.7)] focus-visible:shadow-[0_0_0_3px_rgba(167,139,250,0.15)] focus-visible:ring-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[12px] text-[rgba(255,255,255,0.7)]">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                className="h-[46px] px-[14px] pr-10 text-[13px] text-white placeholder:text-[rgba(255,255,255,0.35)] focus-visible:border-[rgba(167,139,250,0.7)] focus-visible:shadow-[0_0_0_3px_rgba(167,139,250,0.15)] focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#56566E] hover:text-white transition-colors duration-150"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-[46px] rounded-[13px] text-[14px] font-semibold text-[#1E1B4B] bg-gradient-to-r from-[#A78BFA] to-[#F0ABFC] hover:brightness-110 shadow-[0_4px_14px_rgba(167,139,250,0.4)]"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <p className="text-center text-[12px] text-[rgba(255,255,255,0.45)]">
          Don&apos;t have an account? You need an invite link to join.
        </p>
      </div>
    </div>
  )
}

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'radial-gradient(120% 80% at 100% 0%, rgba(219,39,119,0.22) 0%, transparent 50%), radial-gradient(110% 90% at 0% 100%, rgba(8,145,178,0.22) 0%, transparent 55%), linear-gradient(160deg, #14122B 0%, #0C0B1C 100%)' }}>
        <div className="text-[#56566E]">Loading...</div>
      </div>
    }>
      <LoginPage />
    </Suspense>
  )
}
