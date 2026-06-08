// Room Password Verification Edge Function
// Verifies room passwords server-side so the hash is never exposed to the client
// Accepts room_id + plaintext password, returns valid: true/false

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface VerifyRequest {
  room_id: string
  password: string
}

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { room_id, password } = (await req.json()) as VerifyRequest

    if (!room_id || !password) {
      return new Response(
        JSON.stringify({ valid: false, error: 'room_id and password are required' }),
        { status: 400, headers }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Fetch the room password from server (not exposed to client)
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

    // Supported hash formats: plaintext (backward compat), scrypt, bcrypt
    const storedPassword = room.room_password
    let passwordValid = false

    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2y$')) {
      // BCrypt hash — compare using the Web Crypto API via a Deno-compatible method
      const bcrypt = await import('https://deno.land/x/bcrypt@v0.4.1/mod.ts')
      passwordValid = await bcrypt.compare(password, storedPassword)
    } else {
      // Plaintext comparison (legacy support for existing passwords)
      passwordValid = password === storedPassword
    }

    return new Response(
      JSON.stringify({ valid: passwordValid }),
      { status: 200, headers }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers }
    )
  }
})
