'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Save, X, Shield } from 'lucide-react'
import type { Tables, Updates } from '@/lib/supabase/database.types'

interface RoomSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  room: Tables<'rooms'>
  isAdmin: boolean
  onRoomUpdated?: () => void
}

export default function RoomSettingsModal({
  open,
  onOpenChange,
  room,
  isAdmin,
  onRoomUpdated,
}: RoomSettingsModalProps) {
  const supabase = useRef(createClient()).current
  const [name, setName] = useState(room.name)
  const [description, setDescription] = useState(room.description || '')
  // Use message_ttl_seconds directly (no more hours conversion)
  const [messageTtlSeconds, setMessageTtlSeconds] = useState<number>(
    room.message_ttl_seconds ?? (room.message_ttl_hours ? room.message_ttl_hours * 3600 : 0)
  )
  const [slowModeSeconds, setSlowModeSeconds] = useState<number>(room.slow_mode_seconds || 0)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (open) {
      setName(room.name)
      setDescription(room.description || '')
      setMessageTtlSeconds(
        room.message_ttl_seconds ?? (room.message_ttl_hours ? room.message_ttl_hours * 3600 : 0)
      )
      setSlowModeSeconds(room.slow_mode_seconds || 0)
      setEditing(false)
    }
  }, [open, room])

  async function handleSave() {
    if (!isAdmin) return
    setSaving(true)

    const updates: Updates<'rooms'> = {}
    if (name !== room.name) updates.name = name
    if (description !== (room.description || '')) updates.description = description
    // Save TTL in seconds directly (no hours conversion)
    const savedTtlSeconds = messageTtlSeconds > 0 ? messageTtlSeconds : null
    const currentTtlSeconds = room.message_ttl_seconds ?? (room.message_ttl_hours ? room.message_ttl_hours * 3600 : null)
    if (savedTtlSeconds !== currentTtlSeconds) {
      updates.message_ttl_seconds = savedTtlSeconds
    }
    if (slowModeSeconds !== (room.slow_mode_seconds || 0)) updates.slow_mode_seconds = slowModeSeconds || 0

    if (Object.keys(updates).length === 0) {
      setSaving(false)
      setEditing(false)
      toast.info('No changes to save')
      return
    }

    const { error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', room.id)

    setSaving(false)

    if (error) {
      toast.error('Failed to save room settings')
      return
    }

    toast.success('Room settings updated')
    setEditing(false)
    onRoomUpdated?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{room.icon_emoji}</span>
            <span>{room.name}</span>
          </DialogTitle>
          <DialogDescription>
            Room settings and configuration
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Room Info Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-[rgba(255,255,255,0.45)]" />
              Room Info
            </h3>
            <div className="glass-card rounded-[12px] p-3 space-y-2">
              {editing && isAdmin ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-[rgba(255,255,255,0.45)]">Room Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9 text-sm"
                      placeholder="Room name"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[rgba(255,255,255,0.45)]">Description</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="text-sm min-h-[60px]"
                      placeholder="Room description"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[rgba(255,255,255,0.45)]">Name</span>
                    <span className="text-sm text-white">{room.name}</span>
                  </div>
                  <Separator className="opacity-30" />
                  <div className="flex items-start justify-between">
                    <span className="text-xs text-[rgba(255,255,255,0.45)]">Description</span>
                    <span className="text-sm text-white text-right max-w-[250px]">
                      {room.description || 'No description'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Admin Settings Section */}
          {isAdmin && (
            <>
              <Separator className="opacity-30" />

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-[#A78BFA]" />
                  Admin Settings
                </h3>

                {/* Message TTL */}
                <div className="glass-card rounded-[12px] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-white">Message TTL (seconds)</Label>
                    <span className="text-xs text-[rgba(255,255,255,0.45)]">
                      {messageTtlSeconds > 0
                        ? `Messages expire after ${messageTtlSeconds}s`
                        : 'Never expire'}
                    </span>
                  </div>
                  <Input
                    type="number"
                    value={messageTtlSeconds}
                    onChange={(e) => setMessageTtlSeconds(Number(e.target.value))}
                    className="h-9 text-sm"
                    placeholder="0 = never expire"
                    min={0}
                    step={60}
                  />
                  <p className="text-[10px] text-[rgba(255,255,255,0.35)]">
                    Set to 0 for messages to never expire. Values in seconds (e.g. 3600 = 1 hour)
                  </p>
                </div>

                {/* Slow Mode */}
                <div className="glass-card rounded-[12px] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-white">Slow Mode (seconds)</Label>
                    <span className="text-xs text-[rgba(255,255,255,0.45)]">
                      {slowModeSeconds > 0
                        ? `${slowModeSeconds}s between messages`
                        : 'No limit'}
                    </span>
                  </div>
                  <Input
                    type="number"
                    value={slowModeSeconds}
                    onChange={(e) => setSlowModeSeconds(Number(e.target.value))}
                    className="h-9 text-sm"
                    placeholder="0 = no limit"
                    min={0}
                    step={5}
                  />
                  <p className="text-[10px] text-[rgba(255,255,255,0.35)]">
                    Cooldown between messages in seconds. Set to 0 for no limit.
                  </p>
                </div>

                {/* Edit Name & Description Toggle */}
                <div className="flex items-center justify-between glass-card rounded-[12px] p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm text-white">Edit Room Details</Label>
                    <p className="text-[10px] text-[rgba(255,255,255,0.35)]">
                      Toggle to edit the room name and description
                    </p>
                  </div>
                  <Switch
                    checked={editing}
                    onCheckedChange={setEditing}
                  />
                </div>
              </div>
            </>
          )}

        </div>

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-[rgba(255,255,255,0.08)] backdrop-blur-[28px] border-t border-[rgba(255,255,255,0.08)] px-6 py-4 flex justify-end gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Close
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="text-xs"
              >
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
      </DialogContent>
    </Dialog>
  )
}
