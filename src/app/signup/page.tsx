'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Check, X } from 'lucide-react'
import { generateNameSuggestions } from '@/lib/utils/name-generator'
import { getAvatarColor } from '@/lib/utils/avatar-color'
import { toast } from 'sonner'

export default function SignupPage() {
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
    // Generate name suggestions on mount
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

  // Debounced name availability check
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
    // Simple password strength check
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
      // Create auth user
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

      // Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        anonymous_name: name,
        avatar_color: getAvatarColor(name),
        status: 'pending',
      })

      if (profileError) throw profileError

      // Increment invite link usage
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary mb-4">
            <span className="text-3xl">👻</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Join UnderTable</h1>
          <p className="text-sm text-muted-foreground mt-1">
            What happens UnderTable, stays UnderTable.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {!error && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name suggestions */}
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
                    className="rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Name input */}
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
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : nameAvailable === true ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : nameAvailable === false ? (
                    <X className="h-4 w-4 text-destructive" />
                  ) : null}
                </div>
              </div>
              {nameAvailable === false && (
                <p className="text-xs text-destructive">This name is already taken</p>
              )}
            </div>

            {/* Email */}
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

            {/* Password */}
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
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        passwordStrength === 'weak'
                          ? 'w-1/3 bg-destructive'
                          : passwordStrength === 'fair'
                          ? 'w-2/3 bg-warning'
                          : 'w-full bg-success'
                      }`}
                    />
                  </div>
                  <span className={`text-xs capitalize ${
                    passwordStrength === 'weak'
                      ? 'text-destructive'
                      : passwordStrength === 'fair'
                      ? 'text-warning'
                      : 'text-success'
                  }`}>
                    {passwordStrength}
                  </span>
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
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
