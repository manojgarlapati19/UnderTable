'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, X, Ban, Loader2 } from 'lucide-react'
import { getRelativeTime } from '@/lib/utils/time'
import { toast } from 'sonner'

interface ReportWithMessage {
  id: string
  message_id: string
  reported_by: string
  reason: string
  status: string
  created_at: string
  messages: {
    content: string
    is_flagged: boolean
    user_id: string
    room_id: string
    rooms: { name: string; icon_emoji: string }
    profiles: { anonymous_name: string }
  }
}

interface FlaggedMessage {
  id: string
  content: string
  user_id: string
  room_id: string
  is_flagged: boolean
  rooms: { name: string; icon_emoji: string }
  profiles: { anonymous_name: string }
}

export default function AdminReportsPage() {
  const supabase = createClient()
  const [reports, setReports] = useState<ReportWithMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')

  useEffect(() => {
    loadReports()
  }, [tab])

  async function loadReports() {
    setLoading(true)

    if (tab === 'auto-flagged') {
      // For auto-flagged, query flagged messages directly and build report-like entries
      const { data: flaggedMessages } = await supabase
        .from('messages')
        .select(`
          id, content, user_id, room_id, is_flagged,
          rooms!inner(name, icon_emoji),
          profiles!inner(anonymous_name)
        `)
        .eq('is_flagged', true)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })

      if (flaggedMessages) {
        const synthetic: ReportWithMessage[] = flaggedMessages.map((m: FlaggedMessage) => ({
          id: `flagged-${m.id}`,
          message_id: m.id,
          reported_by: '',
          reason: 'Auto-flagged',
          status: 'pending',
          created_at: new Date().toISOString(),
          messages: {
            content: m.content,
            is_flagged: m.is_flagged,
            user_id: m.user_id,
            room_id: m.room_id,
            rooms: m.rooms,
            profiles: m.profiles,
          },
        }))
        setReports(synthetic)
      }
      setLoading(false)
      return
    }

    let query = supabase
      .from('reports')
      .select(`
        *,
        messages!inner(
          content, user_id, room_id, is_flagged,
          rooms!inner(name, icon_emoji),
          profiles!inner(anonymous_name)
        )
      `)
      .order('created_at', { ascending: false })

    if (tab === 'pending') query = query.eq('status', 'pending')
    else if (tab === 'reviewed') query = query.in('status', ['reviewed', 'dismissed'])

    const { data } = await query
    if (data) setReports(data as ReportWithMessage[])
    setLoading(false)
  }

  async function dismissReport(reportId: string) {
    const { error } = await supabase
      .from('reports')
      .update({ status: 'dismissed' })
      .eq('id', reportId)

    if (!error) {
      toast.success('Report dismissed')
      setReports((prev) => prev.filter((r) => r.id !== reportId))
    }
  }

  async function deleteReportedMessage(reportId: string, messageId: string) {
    const { error } = await supabase
      .from('messages')
      .update({ is_deleted: true, content: 'this message was removed' })
      .eq('id', messageId)

    if (!error) {
      await supabase.from('reports').update({ status: 'reviewed' }).eq('id', reportId)
      toast.success('Message deleted')
      setReports((prev) => prev.filter((r) => r.id !== reportId))
    }
  }

  async function banUser(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'banned' })
      .eq('id', userId)

    if (!error) {
      toast.success('User banned')
    }
  }

  async function unflagMessage(messageId: string) {
    const { error } = await supabase
      .from('messages')
      .update({ is_flagged: false })
      .eq('id', messageId)

    if (!error) {
      toast.success('Message approved')
      setReports((prev) => prev.filter((r) => r.message_id !== messageId))
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#A78BFA]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-medium text-white">Reports</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          <TabsTrigger value="auto-flagged">Auto-Flagged</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {reports.length === 0 ? (
            <p className="text-sm text-[rgba(255,255,255,0.45)]">No reports to review</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="glass-card rounded-[14px] p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={report.messages.is_flagged ? 'warning' : 'destructive'}>
                        {report.messages.is_flagged ? 'Auto-flagged' : report.reason}
                      </Badge>
                      <span className="text-xs text-[#56566E]">
                        {getRelativeTime(report.created_at)}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {report.messages.rooms.icon_emoji} {report.messages.rooms.name}
                    </Badge>
                  </div>

                  <p className="text-sm text-white bg-[rgba(255,255,255,0.03)] rounded-[13px] p-2 mb-2 border border-[rgba(255,255,255,0.08)]">
                    {report.messages.content}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#56566E]">
                      From: {report.messages.profiles.anonymous_name}
                    </span>
                    <div className="flex gap-1">
                      {report.messages.is_flagged ? (
                        <Button size="sm" variant="outline" onClick={() => unflagMessage(report.message_id)}>
                          <Check className="h-4 w-4 mr-1" /> Approve
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => dismissReport(report.id)}>
                            <X className="h-4 w-4 mr-1" /> Dismiss
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteReportedMessage(report.id, report.message_id)}>
                            <Ban className="h-4 w-4 mr-1" /> Delete
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => banUser(report.messages.user_id)}>
                            Ban User
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
