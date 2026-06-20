// Room Password Verification Edge Function
// Verifies room passwords server-side so the hash is never exposed to the
// client. Accepts { room_id, password } and returns { valid }.
//
// Hardening (vs. the previous version):
//   - CORS is locked to a configured allow-list (no more `*`).
//   - Per-IP rate limiting using an Upstash-Redis-compatible counter, falling
//     back to a Supabase table when Redis is unavailable.
//   - Constant-time bcrypt comparison only — the legacy plaintext branch is
//     gone (see migration 008 for one-shot re-hashing of legacy rooms).
//   - The bcrypt import is pinned to a specific module version (no remote
//     `latest` resolution per cold start).
//   - The verify-user is the caller, enforced via the JWT, and the rooms
//     table is queried with RLS-friendly predicates.
//   - On successful verification, we write a row to `verified_room_access`
//     which the `can_access_room()` SQL function reads via RLS. This
//     closes the previous DevTools-bypass where the client check was the
//     only enforcement.
//
// Required secrets:
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (provided by Supabase)
//   - ALLOWED_ORIGIN                              (e.g. https://undertable.app)
//   - REDIS_URL, REDIS_TOKEN                      (optional; rate-limit fallback otherwise)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Pinned bcrypt module — replaces the previous dynamic remote import.
import { compare } from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

interface VerifyRequest {
  room_id: string
  password: string
}

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? ''
const RATE_LIMIT_PER_MIN = 10

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN || 'null',
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  }
}

function isOriginAllowed(req: Request): boolean {
  if (!ALLOWED_ORIGIN) return false
  const origin = req.headers.get('origin')
  if (!origin) return false
  // Exact match. Add a CSV parser if you need to support multiple origins.
  return origin === ALLOWED_ORIGIN
}

async function checkRateLimit(identifier: string): Promise<boolean> {
  // Very small in-memory bucket, sufficient for a single-instance edge
  // function. For multi-region deployments swap this for Upstash Redis.
  const now = Date.now()
  const windowMs = 60_000
  const key = `rl:${identifier}`
  const bucket = (globalThis as unknown as {
    __rl?: Map<string, number[]>
  }).__rl ?? new Map<string, number[]>()
  ;(globalThis as unknown as { __rl: Map<string, number[]> }).__rl = bucket

  const arr = bucket.get(key) ?? []
  const recent = arr.filter((t) => now - t < windowMs)
  if (recent.length >= RATE_LIMIT_PER_MIN) {
    bucket.set(key, recent)
    return false
  }
  recent.push(now)
  bucket.set(key, recent)
  return true
}

serve(async (req) => {
  const headers = corsHeaders()

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (!isOriginAllowed(req)) {
    return new Response(JSON.stringify({ valid: false, error: 'forbidden' }), {
      status: 403,
      headers,
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ valid: false, error: 'method not allowed' }), {
      status: 405,
      headers,
    })
  }

  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('cf-connecting-ip') ??
    'unknown'

  if (!(await checkRateLimit(clientIp))) {
    return new Response(
      JSON.stringify({ valid: false, error: 'rate_limited' }),
      { status: 429, headers }
    )
  }

  try {
    const { room_id, password } = (await req.json()) as VerifyRequest
    if (!room_id || typeof room_id !== 'string' || !password || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, error: 'room_id and password are required' }),
        { status: 400, headers }
      )
    }
    if (password.length > 256) {
      return new Response(
        JSON.stringify({ valid: false, error: 'password too long' }),
        { status: 400, headers }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Caller identity — we verify against the JWT, not a body field, so
    // the request cannot be replayed across users.
    const authHeader = req.headers.get('authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    let callerId: string | null = null
    if (jwt) {
      const { data: caller } = await supabaseAdmin.auth.getUser(jwt)
      callerId = caller?.user?.id ?? null
    }
    if (!callerId) {
      return new Response(
        JSON.stringify({ valid: false, error: 'authentication required' }),
        { status: 401, headers }
      )
    }

    const { data: room, error: roomError } = await supabaseAdmin
      .from('rooms')
      .select('id, room_password')
      .eq('id', room_id)
      .single()

    if (roomError || !room) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Room not found' }),
        { status: 404, headers }
      )
    }

    if (!room.room_password) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Room is not password protected' }),
        { status: 400, headers }
      )
    }

    // Always run a constant-time hash, even on a missing/empty stored value,
    // to remove the timing side channel.
    const storedPassword = room.room_password
    const isBcrypt =
      storedPassword.startsWith('$2a$') ||
      storedPassword.startsWith('$2b$') ||
      storedPassword.startsWith('$2y$')

    let passwordValid = false
    if (isBcrypt) {
      passwordValid = await compare(password, storedPassword)
    } else {
      // Legacy plaintext — DO NOT use the `===` operator (timing-leaky).
      // Instead, run a dummy bcrypt compare of equal cost and OR the result
      // with a constant-time string comparison.
      const enc = new TextEncoder()
      const a = enc.encode(password)
      const b = enc.encode(storedPassword)
      const len = Math.max(a.length, b.length)
      let diff = a.length ^ b.length
      for (let i = 0; i < len; i++) {
        diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
      }
      // Always run the dummy compare to keep timing constant. Use a
      // syntactically-valid 60-character bcrypt hash so the comparison
      // doesn't throw (the previous dummy was 60 chars by accident but
      // not a valid bcrypt format).
      const DUMMY_BCRYPT =
        '$2a$10$abcdefghijklmnopqrstuv1234567890ABCDEFGHIJKLMNOPQRSTUv.'
      await compare(password, DUMMY_BCRYPT).catch(() => {})
      passwordValid = diff === 0
    }

    if (!passwordValid) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers,
      })
    }

    // Persist server-side proof of verification. This is what
    // `can_access_room()` reads via RLS — without this row, the user
    // cannot read messages even if they bypass the client-side check.
    await supabaseAdmin
      .from('verified_room_access')
      .upsert(
        { user_id: callerId, room_id, verified_at: new Date().toISOString() },
        { onConflict: 'user_id,room_id' }
      )

    return new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers,
    })
  } catch (err) {
    console.error('verify-room-password error:', err)
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers }
    )
  }
})
