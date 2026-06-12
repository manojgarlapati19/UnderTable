'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Lock, Flame, Edit, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Tables } from '@/lib/supabase/database.types'

export default function AdminRoomsPage() {
  const supabase = createClient()
  const [rooms, setRooms] = useState<Tables<'rooms'>[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Tables<'rooms'> | null>(null)
  const [deletingRoom, setDeletingRoom] = useState<Tables<'rooms'> | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    icon_emoji: '#',
    accent_color: '#7C3AED',
    is_private: false,
    is_confession_box: false,
    message_ttl_hours: '' as string,
    slow_mode_seconds: '0',
    room_password: '',
  })

  useEffect(() => {
    loadRooms()
  }, [])

  async function loadRooms() {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, name, description, icon_emoji, is_confession_box, is_active, has_password, is_private, is_readonly, slow_mode_seconds, message_ttl_seconds, message_ttl_hours, created_by, created_at')
      .order('name')

    if (error) {
      console.error('Failed to load rooms:', error)
      toast.error('Failed to refresh rooms list')
      setLoading(false)
      return
    }

    if (data) setRooms(data)
    setLoading(false)
  }

  async function createRoom() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('rooms').insert({
      name: form.name,
      description: form.description,
      icon_emoji: form.icon_emoji || '#',
      accent_color: form.accent_color,
      is_private: form.is_private,
      is_confession_box: form.is_confession_box,
      message_ttl_hours: form.message_ttl_hours ? parseInt(form.message_ttl_hours) : null,
      slow_mode_seconds: parseInt(form.slow_mode_seconds) || 0,
      room_password: form.room_password || null,
      created_by: user.id,
    })

    if (!error) {
      toast.success('Room created!')
      setShowCreate(false)
      resetForm()
      await loadRooms()
    }
  }

  async function updateRoom() {
    if (!editingRoom) return

    const { error } = await supabase
      .from('rooms')
      .update({
        name: form.name,
        description: form.description,
        icon_emoji: form.icon_emoji,
        accent_color: form.accent_color,
        is_private: form.is_private,
        is_confession_box: form.is_confession_box,
        message_ttl_hours: form.message_ttl_hours ? parseInt(form.message_ttl_hours) : null,
        slow_mode_seconds: parseInt(form.slow_mode_seconds) || 0,
        room_password: form.room_password || null,
      })
      .eq('id', editingRoom.id)

    if (!error) {
      toast.success('Room updated!')
      setEditingRoom(null)
      resetForm()
      await loadRooms()
    }
  }

  async function deleteRoom(roomId: string) {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', roomId)

    if (error) {
      toast.error('Failed to delete room')
      return
    }

    toast.success('Room deleted')
    setDeletingRoom(null)
    await loadRooms()
  }

  function resetForm() {
    setForm({
      name: '',
      description: '',
      icon_emoji: '#',
      accent_color: '#7C3AED',
      is_private: false,
      is_confession_box: false,
      message_ttl_hours: '',
      slow_mode_seconds: '0',
      room_password: '',
    })
  }

  function openEdit(room: Tables<'rooms'>) {
    setEditingRoom(room)
    setForm({
      name: room.name,
      description: room.description,
      icon_emoji: room.icon_emoji,
      accent_color: room.accent_color,
      is_private: room.is_private,
      is_confession_box: room.is_confession_box,
      message_ttl_hours: room.message_ttl_hours?.toString() || '',
      slow_mode_seconds: room.slow_mode_seconds.toString(),
      room_password: room.room_password || '',
    })
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#A78BFA]" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium text-white">Rooms</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Create Room
        </Button>
      </div>

      <div className="space-y-2">
        {rooms.map((room) => (
          <div key={room.id} className="flex items-center gap-3 glass-card rounded-[14px] p-3 hover:border-[rgba(255,255,255,0.2)] transition-all duration-150">
            <span className="text-xl">{room.icon_emoji}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{room.name}</span>
                {room.room_password && <Lock className="h-3 w-3 text-[#A78BFA]" />}
                {room.is_private && <Lock className="h-3 w-3 text-[#56566E]" />}
                {room.is_confession_box && <Flame className="h-3 w-3 text-orange-500" />}
              </div>
              {room.description && (
                <p className="text-xs text-[rgba(255,255,255,0.45)]">{room.description}</p>
              )}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px]" onClick={() => openEdit(room)}>
                <Edit className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-[8px] text-red-400" onClick={() => setDeletingRoom(room)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showCreate || !!editingRoom} onOpenChange={(open) => {
        if (!open) { setShowCreate(false); setEditingRoom(null); resetForm() }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Edit Room' : 'Create Room'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Room Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. #general" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Room purpose" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Emoji Icon</Label>
                <Input value={form.icon_emoji} onChange={(e) => setForm({ ...form, icon_emoji: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.accent_color}
                    onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                    className="h-9 w-12 rounded-[8px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] cursor-pointer"
                  />
                  <span className="text-xs text-[rgba(255,255,255,0.45)]">{form.accent_color}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Room Passcode (optional)</Label>
              <Input
                type="password"
                value={form.room_password}
                onChange={(e) => setForm({ ...form, room_password: e.target.value })}
                placeholder="leave empty for open room"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_private} onCheckedChange={(v) => setForm({ ...form, is_private: v })} />
                <Label className="cursor-pointer text-white">Private</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_confession_box} onCheckedChange={(v) => setForm({ ...form, is_confession_box: v })} />
                <Label className="cursor-pointer text-white">Confession Box</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Message TTL (hours)</Label>
                <Input type="number" value={form.message_ttl_hours} onChange={(e) => setForm({ ...form, message_ttl_hours: e.target.value })} placeholder="Leave empty for none" />
              </div>
              <div className="space-y-2">
                <Label>Slow Mode (seconds)</Label>
                <Select value={form.slow_mode_seconds} onValueChange={(v) => setForm({ ...form, slow_mode_seconds: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Disabled</SelectItem>
                    <SelectItem value="10">10s</SelectItem>
                    <SelectItem value="30">30s</SelectItem>
                    <SelectItem value="60">60s</SelectItem>
                    <SelectItem value="120">120s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={editingRoom ? updateRoom : createRoom} className="w-full">
              {editingRoom ? 'Save Changes' : 'Create Room'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingRoom} onOpenChange={(open) => { if (!open) setDeletingRoom(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>#{deletingRoom?.name}</strong>?
              <br />
              This will permanently delete all messages in this room.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingRoom(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingRoom && deleteRoom(deletingRoom.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
