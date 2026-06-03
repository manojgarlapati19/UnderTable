'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Send, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Tables } from '@/lib/supabase/database.types'

export default function AdminStartersPage() {
  const supabase = createClient()
  const [starters, setStarters] = useState<Tables<'conversation_starters'>[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStarters()
  }, [])

  async function loadStarters() {
    const { data } = await supabase
      .from('conversation_starters')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setStarters(data)
    setLoading(false)
  }

  async function addStarter() {
    if (!newQuestion.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('conversation_starters').insert({
      question: newQuestion.trim(),
      created_by: user.id,
    })

    if (!error) {
      toast.success('Conversation starter added!')
      setNewQuestion('')
      loadStarters()
    }
  }

  async function deleteStarter(id: string) {
    const { error } = await supabase.from('conversation_starters').delete().eq('id', id)
    if (!error) {
      toast.success('Starter deleted')
      loadStarters()
    }
  }

  async function postNow(question: string, starterId: string) {
    const { data: generalRoom } = await supabase
      .from('rooms')
      .select('id')
      .eq('name', '#general')
      .single()

    if (!generalRoom) {
      toast.error('#general room not found')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: msgError } = await supabase.from('messages').insert({
      room_id: generalRoom.id,
      user_id: user.id,
      content: `💡 Conversation starter: ${question}`,
    })

    if (!msgError) {
      await supabase
        .from('conversation_starters')
        .update({ posted_at: new Date().toISOString() })
        .eq('id', starterId)

      toast.success('Posted to #general!')
      loadStarters()
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#A78BFA]" /></div>
  }

  const unposted = starters.filter((s) => !s.posted_at)
  const posted = starters.filter((s) => s.posted_at)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium text-white">Conversation Starters</h1>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="question">Add a question</Label>
          <Input
            id="question"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addStarter()}
            placeholder="e.g. What's the best productivity hack you've discovered?"
          />
        </div>
        <Button onClick={addStarter} disabled={!newQuestion.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white">Ready to Post ({unposted.length})</h3>
        {unposted.length === 0 ? (
          <p className="text-sm text-[rgba(255,255,255,0.45)]">All starters have been posted</p>
        ) : (
          <div className="space-y-2">
            {unposted.map((starter) => (
              <div key={starter.id} className="flex items-center gap-3 glass-card rounded-[14px] p-3">
                <p className="flex-1 text-sm text-white">{starter.question}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => postNow(starter.question, starter.id)}>
                    <Send className="h-3 w-3 mr-1" /> Post now
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteStarter(starter.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-[#56566E]">Already Posted ({posted.length})</h3>
        {posted.map((starter) => (
          <div key={starter.id} className="flex items-center gap-3 rounded-[16px] border border-[#22223A] bg-[#13131F] p-3 opacity-60">
            <p className="flex-1 text-sm text-white">{starter.question}</p>
            <Badge variant="secondary">Posted</Badge>
            <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteStarter(starter.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
