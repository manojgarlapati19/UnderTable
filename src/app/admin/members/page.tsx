'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { getAvatarColor } from '@/lib/utils/avatar-color'
import { getRelativeTime } from '@/lib/utils/time'

import { Check, X, Ban, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Tables } from '@/lib/supabase/database.types'

export default function AdminMembersPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<Tables<'profiles'>[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState('pending')

  useEffect(() => {
    // FIX: selectedIds previously persisted across tab switches. Since
    // checkboxes only render on the pending/rejected tabs, a selection made
    // on one tab could silently survive into the other and get bulk-acted
    // on there instead of the currently-visible rows. Clear it whenever the
    // tab changes.
    setSelectedIds(new Set())
    loadMembers()
  }, [tab])

  async function loadMembers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', tab === 'pending' ? 'pending' : tab === 'approved' ? 'approved' : tab === 'rejected' ? 'rejected' : 'banned')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load members')
    } else {
      setMembers(data || [])
    }
    setLoading(false)
  }

  async function approveMember(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', userId)

    if (error) {
      toast.error(`Failed to approve member: ${error.message}`)
      return
    }
    toast.success('Member approved')
    setMembers((prev) => prev.filter((m) => m.id !== userId))
  }

  async function rejectMember(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'rejected' })
      .eq('id', userId)

    if (error) {
      toast.error(`Failed to reject member: ${error.message}`)
      return
    }
    toast.success('Member rejected')
    setMembers((prev) => prev.filter((m) => m.id !== userId))
  }

  async function banMember(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'banned' })
      .eq('id', userId)

    if (error) {
      toast.error(`Failed to ban member: ${error.message}`)
      return
    }
    toast.success('Member banned')
    setMembers((prev) => prev.filter((m) => m.id !== userId))
  }

  async function unbanMember(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'approved' })
      .eq('id', userId)

    if (error) {
      toast.error(`Failed to unban member: ${error.message}`)
      return
    }
    toast.success('Member unbanned')
    setMembers((prev) => prev.filter((m) => m.id !== userId))
  }

  async function bulkApprove() {
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map((id) => approveMember(id)))
    setSelectedIds(new Set())
  }

  async function bulkReject() {
    const ids = Array.from(selectedIds)
    await Promise.all(ids.map((id) => rejectMember(id)))
    setSelectedIds(new Set())
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[#A78BFA]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium text-white">Members</h1>
        {selectedIds.size > 0 && (tab === 'pending' || tab === 'rejected') && (
          <div className="flex gap-2">
            <Button size="sm" className="bg-[#22C55E] hover:bg-[#16A34A] text-white" onClick={bulkApprove}>Approve all ({selectedIds.size})</Button>
            <Button size="sm" variant="destructive" onClick={bulkReject}>Reject all ({selectedIds.size})</Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="banned">Banned</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {members.length === 0 ? (
            <p className="text-sm text-[rgba(255,255,255,0.45)]">No pending approvals</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 glass-card rounded-[14px] p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(member.id)}
                    onChange={() => toggleSelect(member.id)}
                    className="rounded border-[#22223A] bg-[#0B0B14] accent-accent"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback style={{ backgroundColor: getAvatarColor(member.anonymous_name) }} className="text-white text-xs">
                      {member.anonymous_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{member.anonymous_name}</p>
                    <p className="text-xs text-[#56566E]">Joined {getRelativeTime(member.created_at)}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-[#22C55E] hover:text-[#22C55E] hover:bg-[#22C55E]/10" onClick={() => approveMember(member.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => rejectMember(member.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          {members.length === 0 ? (
            <p className="text-sm text-[rgba(255,255,255,0.45)]">No approved members</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 glass-card rounded-[14px] p-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback style={{ backgroundColor: getAvatarColor(member.anonymous_name) }} className="text-white text-xs">
                      {member.anonymous_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{member.anonymous_name}</p>
                    <p className="text-xs text-[#56566E]">
                      {member.role === 'admin' && <Badge variant="default" className="mr-1">Admin</Badge>}
                      Joined {getRelativeTime(member.created_at)}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => banMember(member.id)}>
                    <Ban className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-4">
          {members.length === 0 ? (
            <p className="text-sm text-[rgba(255,255,255,0.45)]">No rejected members</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 glass-card rounded-[14px] p-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(member.id)}
                    onChange={() => toggleSelect(member.id)}
                    className="rounded border-[#22223A] bg-[#0B0B14] accent-accent"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback style={{ backgroundColor: getAvatarColor(member.anonymous_name) }} className="text-white text-xs">
                      {member.anonymous_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{member.anonymous_name}</p>
                    <p className="text-xs text-[#56566E]">Rejected</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-[#22C55E] hover:text-[#22C55E] hover:bg-[#22C55E]/10" onClick={() => approveMember(member.id)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10" onClick={() => banMember(member.id)}>
                      <Ban className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="banned" className="mt-4">
          {members.length === 0 ? (
            <p className="text-sm text-[rgba(255,255,255,0.45)]">No banned members</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 glass-card rounded-[14px] p-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback style={{ backgroundColor: getAvatarColor(member.anonymous_name) }} className="text-white text-xs">
                      {member.anonymous_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{member.anonymous_name}</p>
                    <p className="text-xs text-[#56566E]">Banned</p>
                  </div>
                  <Button size="sm" variant="ghost" className="text-[#22C55E] hover:text-[#22C55E] hover:bg-[#22C55E]/10" onClick={() => unbanMember(member.id)}>
                    Unban
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
