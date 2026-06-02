import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find the #general room
    const { data: generalRoom } = await supabase
      .from('rooms')
      .select('id')
      .eq('name', '#general')
      .single()

    if (!generalRoom) {
      return new Response(
        JSON.stringify({ success: false, error: '#general room not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Pick a random unposted conversation starter
    const { data: starters } = await supabase
      .from('conversation_starters')
      .select('*')
      .is('posted_at', null)
      .limit(10)

    if (!starters || starters.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No unposted conversation starters available' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Pick a random starter
    const randomStarter = starters[Math.floor(Math.random() * starters.length)]

    // Find an admin user to post as
    const { data: adminUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'approved')
      .limit(1)
      .single()

    if (!adminUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'No admin user found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Post the starter as a system message
    const { error: insertError } = await supabase
      .from('messages')
      .insert({
        room_id: generalRoom.id,
        user_id: adminUser.id,
        content: `💡 Conversation starter: ${randomStarter.question}`,
      })

    if (insertError) throw insertError

    // Mark as posted
    await supabase
      .from('conversation_starters')
      .update({ posted_at: new Date().toISOString() })
      .eq('id', randomStarter.id)

    return new Response(
      JSON.stringify({
        success: true,
        starter: randomStarter.question,
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
