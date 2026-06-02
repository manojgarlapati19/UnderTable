// Follow Deno/Edge Functions conventions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

interface ExpireMessagesPayload {
  type: 'CRON'
  schedule: string
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Delete messages where expires_at is in the past
    const { data, error } = await supabase
      .from('messages')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id')

    if (error) throw error

    return new Response(
      JSON.stringify({
        success: true,
        deleted_count: data?.length || 0,
        timestamp: new Date().toISOString(),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
