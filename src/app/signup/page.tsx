'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Check, X } from 'lucide-react'
import { generateNameSuggestions } from '@/lib/utils/name-generator'
import { getAvatarColor } from '@/lib/utils/avatar-color'
import { toast } from 'sonner'

function SignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('code')
  const supabase = createClient()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null)
  const [checkingName, setCheckingName] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'fair' | 'strong' | ''>('')
  const debounceRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!inviteCode) {
      router.push('/login')
      return
    }
    setSuggestions(generateNameSuggestions(3))
    validateInvite()
  }, [inviteCode])

  async function validateInvite() {
    const { data } = await supabase
      .from('invite_links')
      .select('is_active, max_uses, uses_count')
      .eq('code', inviteCode)
      .single()

    if (!data || !data.is_active || (data.max_uses && data.uses_count >= data.max_uses)) {
      setError('This invite link is invalid or has expired.')
    }
  }

  const checkNameAvailability = useCallback(
    async (nameToCheck: string) => {
      if (nameToCheck.length < 3) {
        setNameAvailable(null)
        return
      }

      setCheckingName(true)
      const { data } = await supabase
        .from('profiles')
        .select('anonymous_name')
        .eq('anonymous_name', nameToCheck)
        .maybeSingle()

      setNameAvailable(!data)
      setCheckingName(false)
    },
    [supabase]
  )

  function handleNameChange(value: string) {
    setName(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => checkNameAvailability(value), 500)
  }

  function handlePasswordChange(value: string) {
    setPassword(value)
    if (value.length < 6) setPasswordStrength('weak')
    else if (value.length < 10 || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) setPasswordStrength('fair')
    else setPasswordStrength('strong')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nameAvailable || !inviteCode) return

    setLoading(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            anonymous_name: name,
          },
        },
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('Failed to create account')

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        anonymous_name: name,
        avatar_color: getAvatarColor(name),
        status: 'pending',
      })

      if (profileError) throw profileError

      const { data: inviteLink } = await supabase
        .from('invite_links')
        .select('id, uses_count')
        .eq('code', inviteCode)
        .single()

      if (inviteLink) {
        await supabase
          .from('invite_links')
          .update({ uses_count: (inviteLink.uses_count || 0) + 1 })
          .eq('id', inviteLink.id)
      }

      toast.success('Account created! Wait for admin approval.')
      router.push('/pending')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create account'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (!inviteCode) return null

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-auth p-8 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-[17px] ghost-glow mb-5">
            <span className="text-2xl font-bold text-[#2E1065]">U</span>
          </div>
          <h1 className="text-[26px] font-medium text-white">Join UnderTable</h1>
          <p className="text-sm text-[rgba(255,255,255,0.7)] mt-1">
            What happens UnderTable, stays UnderTable.
          </p>
        </div>

        {error && (
          <div className="rounded-[13px] bg-red-500/10 p-3 text-sm text-red-400 text-center border border-red-500/20">
            {error}
          </div>
        )}

        {!error && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Choose your anonymous name</Label>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      setName(suggestion)
                      checkNameAvailability(suggestion)
                    }}
                    className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] backdrop-blur-[20px] px-3 py-1.5 text-xs text-white transition-all duration-150 hover:border-[#C4B5FD] hover:bg-[rgba(255,255,255,0.1)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">or type your own name</Label>
              <div className="relative">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Your anonymous name"
                  required
                  minLength={3}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingName ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#56566E]" />
                  ) : nameAvailable === true ? (
                    <Check className="h-4 w-4 text-[#22C55E]" />
                  ) : nameAvailable === false ? (
                    <X className="h-4 w-4 text-[#EF4444]" />
                  ) : null}
                </div>
              </div>
              {nameAvailable === false && (
                <p className="text-xs text-[#EF4444]">This name is already taken</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                placeholder="Create a password"
                required
                minLength={6}
              />
              {passwordStrength && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[#18182A] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        passwordStrength === 'weak'
                          ? 'w-1/3 bg-[#EF4444]'
                          : passwordStrength === 'fair'
                          ? 'w-2/3 bg-[#F59E0B]'
                          : 'w-full bg-[#22C55E]'
                      }`}
                    />
                  </div>
                  <span className={`text-xs capitalize ${
                    passwordStrength === 'weak'
                      ? 'text-[#EF4444]'
                      : passwordStrength === 'fair'
                      ? 'text-[#F59E0B]'
                      : 'text-[#22C55E]'
                  }`}>
                    {passwordStrength}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10"
              disabled={loading || !nameAvailable || !name || !email || !password}
            >
              {loading ? 'Creating account...' : 'Join UnderTable'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function SignupPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-auth-bg"><div className="text-[#56566E]">Loading...</div></div>}>
      <SignupPage />
    </Suspense>
  )
}
