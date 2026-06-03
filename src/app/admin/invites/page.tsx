'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Link2, Copy, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { v4 as uuidv4 } from 'uuid'
import { getRelativeTime } from '@/lib/utils/time'
import type { Tables } from '@/lib/supabase/database.types'

export default function AdminInvitesPage() {
  const supabase = createClient()
  const [invites, setInvites] = useState<Tables<'invite_links'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)
  const [maxUses, setMaxUses] = useState('')

  useEffect(() => {
    loadInvites()
  }, [])

  async function loadInvites() {
    const { data } = await supabase
      .from('invite_links')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setInvites(data)
    setLoading(false)
  }

  async function generateLink() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const code = uuidv4().slice(0, 8)
    const { error } = await supabase.from('invite_links').insert({
      code,
      created_by: user.id,
      max_uses: maxUses ? parseInt(maxUses) : null,
    })

    if (!error) {
      toast.success('Invite link generated!')
      setShowGenerate(false)
      setMaxUses('')
      loadInvites()
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/invite/${code}`
    navigator.clipboard.writeText(url)
    toast.success('Link copied to clipboard!')
  }

  async function revokeLink(id: string) {
    const { error } = await supabase
      .from('invite_links')
      .update({ is_active: false })
      .eq('id', id)

    if (!error) {
      toast.success('Link revoked')
      loadInvites()
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#A78BFA]" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium text-white">Invite Links</h1>
        <Button onClick={() => setShowGenerate(true)}>
          <Link2 className="h-4 w-4 mr-1" /> Generate Link
        </Button>
      </div>

      <div className="glass-card rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)]">
                <th className="text-left px-4 py-2 font-medium text-[#56566E]">Code</th>
                <th className="text-left px-4 py-2 font-medium text-[#56566E]">Created</th>
                <th className="text-left px-4 py-2 font-medium text-[#56566E]">Uses</th>
                <th className="text-left px-4 py-2 font-medium text-[#56566E]">Status</th>
                <th className="text-right px-4 py-2 font-medium text-[#56566E]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id} className="border-b border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-xs bg-[rgba(255,255,255,0.06)] text-white px-1.5 py-0.5 rounded border border-[rgba(255,255,255,0.12)]">{invite.code}</code>
                  </td>
                  <td className="px-4 py-3 text-[rgba(255,255,255,0.45)]">{getRelativeTime(invite.created_at)}</td>
                  <td className="px-4 py-3 text-white">{invite.uses_count}/{invite.max_uses || '∞'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={invite.is_active ? 'success' : 'destructive'}>
                      {invite.is_active ? 'Active' : 'Revoked'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px]" onClick={() => copyLink(invite.code)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      {invite.is_active && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] text-red-400" onClick={() => revokeLink(invite.id)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {invites.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[rgba(255,255,255,0.45)]">
                    No invite links yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invite Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Max uses (optional)</Label>
              <Input
                type="number"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Leave empty for unlimited"
              />
            </div>
            <Button onClick={generateLink} className="w-full">Generate</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
