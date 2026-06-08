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
import { toast } from 'sonner'
import { RefreshCw, UserX, UserCheck, Ghost } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
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
  const [showNameSuggestions, setShowNameSuggestions] = useState(false)
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])

  useEffect(() => {
    if (open) loadData()
  }, [open])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    if (prof) {
      setProfile(prof)
      if (prof.identity_reset_at) {
        const lastReset = new Date(prof.identity_reset_at)
        const nextReset = new Date(lastReset.getTime() + 30 * 24 * 60 * 60 * 1000)
        const remaining = Math.ceil((nextReset.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        setIdentityCooldown(Math.max(0, remaining))
      }
    }

    const { data: rms } = await supabase.from('rooms').select('id, name, icon_emoji, has_password, is_confession_box').order('name')
    if (rms) setRooms(rms)

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

    const { generateNameSuggestions } = await import('@/lib/utils/name-generator')
    const suggestions = generateNameSuggestions(3)
    setNameSuggestions(suggestions)
    setShowNameSuggestions(true)
  }

  async function confirmIdentityReset(newName: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !profile) return

    const { error } = await supabase
      .from('profiles')
      .update({
        anonymous_name: newName,
        identity_reset_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (!error) {
      toast.success('Your new identity is ready!')
      setShowNameSuggestions(false)
      setNameSuggestions([])
      loadData()
    }
  }

  async function unblockUser(blockedId: string) {
    if (!profile) return
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', profile.id)
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

          <TabsContent value="notifications" className="space-y-3 max-h-80 overflow-y-auto">
            <p className="text-sm text-[rgba(255,255,255,0.45)]">
              Configure notification levels for each room
            </p>
            {rooms.map((room) => (
              <div key={room.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span>{room.icon_emoji}</span>
                  <span className="text-sm text-white">{room.name}</span>
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

          <TabsContent value="identity" className="space-y-4">
            <div className="glass-card rounded-[14px] p-4">
              <h3 className="text-sm font-medium text-white mb-2">Current Identity</h3>
              <p className="text-lg font-semibold text-[#A78BFA]">{profile?.anonymous_name}</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-white">Reset Identity</h3>
              <p className="text-xs text-[rgba(255,255,255,0.45)]">
                Get a new anonymous name. Your past messages will retain your old name.
                You can only reset once every 30 days.
              </p>
              {identityCooldown > 0 ? (
                <div className="flex items-center gap-2 text-sm text-[rgba(255,255,255,0.45)]">
                  <RefreshCw className="h-4 w-4" />
                  <span>You can reset your identity in {identityCooldown} day{identityCooldown !== 1 ? 's' : ''}</span>
                </div>
              ) : showNameSuggestions ? (
                <div className="space-y-2">
                  <p className="text-xs text-[rgba(255,255,255,0.45)]">Choose your new identity:</p>
                  <div className="flex flex-wrap gap-2">
                    {nameSuggestions.map((name) => (
                      <button
                        key={name}
                        onClick={() => confirmIdentityReset(name)}
                        className={cn(
                          'rounded-[12px] border border-[rgba(255,255,255,0.12)] px-4 py-2 text-sm text-white transition-all duration-150',
                          'hover:border-[#A78BFA] hover:bg-[rgba(167,139,250,0.1)]'
                        )}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowNameSuggestions(false)} className="text-xs">
                    Cancel
                  </Button>
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
              <h3 className="text-sm font-medium text-white">Ghost Mode</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ghost className="h-4 w-4 text-[rgba(255,255,255,0.45)]" />
                  <div className="space-y-0.5">
                    <p className="text-sm text-white">Hide my presence</p>
                    <p className="text-xs text-[rgba(255,255,255,0.45)]">
                      Your presence, read receipts, and typing indicator will be hidden
                    </p>
                  </div>
                </div>
                <Switch
                  checked={profile?.ghost_mode || false}
                  onCheckedChange={async (checked) => {
                    if (!profile) return
                    const { error } = await supabase
                      .from('profiles')
                      .update({ ghost_mode: checked })
                      .eq('id', profile.id)
                    if (!error) {
                      setProfile({ ...profile, ghost_mode: checked })
                      toast.success(checked ? 'Ghost mode on — you are now invisible' : 'Ghost mode off')
                    }
                  }}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="blocks" className="space-y-3 max-h-80 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <UserX className="h-4 w-4 text-[rgba(255,255,255,0.45)]" />
              <p className="text-sm text-[rgba(255,255,255,0.45)]">
                Blocked users ({blocks.length})
              </p>
            </div>
            {blocks.length === 0 ? (
              <div className="text-center py-8 text-sm text-[rgba(255,255,255,0.45)]">
                <UserX className="h-8 w-8 mx-auto mb-2 opacity-50 text-[rgba(255,255,255,0.45)]" />
                <p>No blocked users</p>
                <p className="text-xs mt-1">Block users from message hover actions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {blocks.map((block) => (
                  <div key={block.id} className="flex items-center justify-between rounded-[12px] px-3 py-2 hover:bg-[rgba(255,255,255,0.06)]">
                    <div className="flex items-center gap-2">
                      <UserX className="h-4 w-4 text-[rgba(255,255,255,0.45)]" />
                      <span className="text-sm text-white">
                        {blockedProfiles.get(block.blocked_id) || 'Unknown user'}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => unblockUser(block.blocked_id)}
                      className="text-xs"
                    >
                      <UserCheck className="h-4 w-4 mr-1" />
                      Unblock
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
