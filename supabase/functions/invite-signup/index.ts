// Invite Signup Edge Function
// Validates invite codes and increments uses_count atomically
// Called from the signup page to avoid RLS blocks on invite_links updates

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface InviteRequest {
  code: string
}

interface InviteResponse {
  valid: boolean
  uses_left?: number
  error?: string
}

serve(async (req) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { code } = (await req.json()) as InviteRequest

    if (!code || typeof code !== 'string') {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invite code is required' }),
        { status: 400, headers }
      )
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Fetch the invite link
    const { data: invite, error: fetchError } = await supabaseAdmin
      .from('invite_links')
      .select('*')
      .eq('code', code)
      .single()

    if (fetchError || !invite) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid invite code' }),
        { status: 404, headers }
      )
    }

    if (!invite.is_active) {
      return new Response(
        JSON.stringify({ valid: false, error: 'This invite link has been revoked' }),
        { status: 403, headers }
      )
    }

    // Check max_uses limit
    if (invite.max_uses !== null && invite.uses_count >= invite.max_uses) {
      return new Response(
        JSON.stringify({ valid: false, error: 'This invite link has reached its maximum uses' }),
        { status: 403, headers }
      )
    }

    // Atomically claim the invite (validates + increments in a single DB transaction)
    const { data: claimResult, error: claimError } = await supabaseAdmin.rpc(
      'claim_invite_code',
      { p_code: code }
    )

    if (claimError || !claimResult?.valid) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: claimResult?.error || claimError?.message || 'Could not claim invite link',
        }),
        { status: 409, headers }
      )
    }

    return new Response(
      JSON.stringify({ valid: true, uses_left: claimResult.uses_left }),
      { status: 200, headers }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Internal server error' }),
      { status: 500, headers }
    )
  }
})
