'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { RefreshCw, Eye, EyeOff, UserX, UserCheck } from 'lucide-react'
import type { Tables } from '@/lib/supabase/database.types'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const supabase = createClient()
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null)
  const [rooms, setRooms] = useState<Tables<'rooms'>[]>([])
  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, string>>({})
  const [blocks, setBlocks] = useState<Tables<'blocks'>[]>([])
  const [blockedProfiles, setBlockedProfiles] = useState<Map<string, string>>(new Map())
  const [identityCooldown, setIdentityCooldown] = useState<number>(0)

  useEffect(() => {
    if (open) loadData()
  }, [open])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Load profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (prof) {
      setProfile(prof)
      // Calculate identity reset cooldown
      if (prof.identity_reset_at) {
        const lastReset = new Date(prof.identity_reset_at)
        const nextReset = new Date(lastReset.getTime() + 30 * 24 * 60 * 60 * 1000)
        const remaining = Math.ceil((nextReset.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        setIdentityCooldown(Math.max(0, remaining))
      }
    }

    // Load rooms
    const { data: rms } = await supabase.from('rooms').select('*').order('name')
    if (rms) setRooms(rms)

    // Load notification preferences
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
    if (prefs) {
      const prefMap: Record<string, string> = {}
      prefs.forEach((p) => { prefMap[p.room_id] = p.level })
      setNotificationPrefs(prefMap)
    }

    // Load blocks
    const { data: blks } = await supabase
      .from('blocks')
      .select('*')
      .eq('blocker_id', user.id)
    if (blks) {
      setBlocks(blks)
      // Load blocked profile names
      const blockedIds = blks.map((b) => b.blocked_id)
      if (blockedIds.length > 0) {
        const { data: blockedProfiles } = await supabase
          .from('profiles')
          .select('id, anonymous_name')
          .in('id', blockedIds)
        if (blockedProfiles) {
          const nameMap = new Map<string, string>()
          blockedProfiles.forEach((p) => nameMap.set(p.id, p.anonymous_name))
          setBlockedProfiles(nameMap)
        }
      }
    }
  }

  async function updateNotificationPref(roomId: string, level: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: user.id,
        room_id: roomId,
        level: level as 'all' | 'mentions' | 'muted',
      }, { onConflict: 'user_id, room_id' })

    if (!error) {
      setNotificationPrefs({ ...notificationPrefs, [roomId]: level })
      toast.success('Notification preference updated')
    }
  }

  async function handleIdentityReset() {
    if (identityCooldown > 0) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Generate new name
    const { generateNameSuggestions } = await import('@/lib/utils/name-generator')
    const suggestions = generateNameSuggestions(3)

    // In a full implementation, show a dialog with suggestions
    const newName = suggestions[0]

    const { error } = await supabase
      .from('profiles')
      .update({
        anonymous_name: newName,
        identity_reset_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (!error) {
      toast.success(`Your new identity is: ${newName}`)
      loadData()
    }
  }

  async function unblockUser(blockedId: string) {
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', profile?.id)
      .eq('blocked_id', blockedId)

    if (!error) {
      setBlocks(blocks.filter((b) => b.blocked_id !== blockedId))
      toast.success('User unblocked')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your notifications, identity, and privacy
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="notifications">
          <TabsList className="w-full">
            <TabsTrigger value="notifications" className="flex-1">Notifications</TabsTrigger>
            <TabsTrigger value="identity" className="flex-1">Identity</TabsTrigger>
            <TabsTrigger value="blocks" className="flex-1">Blocks</TabsTrigger>
          </TabsList>

          {/* Notification Preferences Tab */}
          <TabsContent value="notifications" className="space-y-3 max-h-80 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              Configure notification levels for each room
            </p>
            {rooms.map((room) => (
              <div key={room.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span>{room.icon_emoji}</span>
                  <span className="text-sm">{room.name}</span>
                </div>
                <Select
                  value={notificationPrefs[room.id] || 'all'}
                  onValueChange={(value) => updateNotificationPref(room.id, value)}
                >
                  <SelectTrigger className="w-28 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="mentions">Mentions</SelectItem>
                    <SelectItem value="muted">Muted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </TabsContent>

          {/* Identity Tab */}
          <TabsContent value="identity" className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <h3 className="text-sm font-medium mb-2">Current Identity</h3>
              <p className="text-lg font-semibold text-primary">{profile?.anonymous_name}</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Reset Identity</h3>
              <p className="text-xs text-muted-foreground">
                Get a new anonymous name. Your past messages will retain your old name.
                You can only reset once every 30 days.
              </p>
              {identityCooldown > 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4" />
                  <span>You can reset your identity in {identityCooldown} days</span>
                </div>
              ) : (
                <Button variant="outline" onClick={handleIdentityReset}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Get a new anonymous identity
                </Button>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-medium">Ghost Mode</h3>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm">Hide my presence</p>
                  <p className="text-xs text-muted-foreground">
                    Your presence, read receipts, and typing indicator will be hidden
                  </p>
                </div>
                <Switch
                  checked={profile?.ghost_mode || false}
                  onCheckedChange={async (checked) => {
                    if (!profile) return
                    await supabase
                      .from('profiles')
                      .update({ ghost_mode: checked })
                      .eq('id', profile.id)
                    setProfile({ ...profile, ghost_mode: checked })
                  }}
                />
              </div>
            </div>
          </TabsContent>

          {/* Blocks Tab */}
          <TabsContent value="blocks" className="space-y-3">
            {blocks.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <UserX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No blocked users</p>
              </div>
            ) : (
              blocks.map((block) => (
                <div key={block.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {blockedProfiles.get(block.blocked_id) || 'Unknown user'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => unblockUser(block.blocked_id)}
                  >
                    <UserCheck className="h-4 w-4 mr-1" />
                    Unblock
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
