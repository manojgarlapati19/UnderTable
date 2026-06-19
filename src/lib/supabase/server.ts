// See client.ts for why the third generic is pinned to `any`.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<Database, 'public', any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Called from a Server Component, can be ignored
          }
        },
        remove(name: string, options: Record<string, unknown>) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Called from a Server Component, can be ignored
          }
        },
      },
    }
  )
}

// See client.ts for why the third generic is pinned to `any`.
export async function getServiceRoleClient() {
  const { createClient } = await import('@supabase/supabase-js')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<Database, 'public', any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
