import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Find the #highlights room
    const { data: highlightsRoom } = await supabase
      .from('rooms')
      .select('id')
      .eq('name', '#highlights')
      .single()

    if (!highlightsRoom) {
      return new Response(
        JSON.stringify({ success: false, error: '#highlights room not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get top 5 most-reacted messages from the past 7 days
    const { data: messages } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        created_at,
        room_id,
        rooms!inner(name, icon_emoji),
        reactions:reactions(count)
      `)
      .gte('created_at', sevenDaysAgo)
      .eq('is_deleted', false)
      .order('reactions.count', { ascending: false })
      .limit(5)

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No highlights this week' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Format as highlights message
    let highlightsContent = '🔥 **This week\'s top moments:**\n\n'
    messages.forEach((msg: any, i: number) => {
      const room = msg.rooms as { name: string; icon_emoji: string }
      const date = new Date(msg.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      highlightsContent += `${i + 1}. [${room.icon_emoji} ${room.name}] ${date}\n`
      highlightsContent += `   "${msg.content.slice(0, 150)}"\n\n`
    })

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

    // Post the highlights message
    const { data: newMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        room_id: highlightsRoom.id,
        user_id: adminUser.id,
        content: highlightsContent,
        is_pinned: true,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    // Pin the message
    if (newMessage) {
      await supabase.from('pinned_messages').insert({
        room_id: highlightsRoom.id,
        message_id: newMessage.id,
        pinned_by: adminUser.id,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        highlights_count: messages.length,
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
