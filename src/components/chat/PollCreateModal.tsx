'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { v4 as uuidv4 } from 'uuid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface PollCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomId: string
}

export default function PollCreateModal({ open, onOpenChange, roomId }: PollCreateModalProps) {
  const supabase = createClient()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState([
    { id: uuidv4(), text: '' },
    { id: uuidv4(), text: '' },
  ])
  const [expiryHours, setExpiryHours] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function addOption() {
    if (options.length >= 4) return
    setOptions([...options, { id: uuidv4(), text: '' }])
  }

  function removeOption(id: string) {
    if (options.length <= 2) return
    setOptions(options.filter((o) => o.id !== id))
  }

  function updateOption(id: string, text: string) {
    setOptions(options.map((o) => (o.id === id ? { ...o, text } : o)))
  }

  async function handleSubmit() {
    if (!question.trim() || options.some((o) => !o.text.trim())) {
      toast.error('Please fill in all fields')
      return
    }

    setIsSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const pollOptions = options.map((o) => ({
      id: o.id,
      text: o.text.trim(),
      votes: 0,
    }))

    const expiresAt = expiryHours
      ? new Date(Date.now() + parseInt(expiryHours) * 60 * 60 * 1000).toISOString()
      : null

    const { error } = await supabase.from('polls').insert({
      room_id: roomId,
      created_by: user.id,
      question: question.trim(),
      options: pollOptions,
      expires_at: expiresAt,
    })

    if (!error) {
      toast.success('Poll created!')
      onOpenChange(false)
      setQuestion('')
      setOptions([
        { id: uuidv4(), text: '' },
        { id: uuidv4(), text: '' },
      ])
      setExpiryHours('')
    } else {
      toast.error('Failed to create poll')
    }

    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a Poll</DialogTitle>
          <DialogDescription>Ask the room a question</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to ask?"
            />
          </div>

          <div className="space-y-2">
            <Label>Options ({options.length}/4)</Label>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Input
                    value={option.text}
                    onChange={(e) => updateOption(option.id, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                  />
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300"
                      onClick={() => removeOption(option.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 4 && (
              <Button variant="outline" size="sm" onClick={addOption} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add option
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry (optional, in hours)</Label>
            <Input
              id="expiry"
              type="number"
              min="1"
              max="168"
              value={expiryHours}
              onChange={(e) => setExpiryHours(e.target.value)}
              placeholder="Leave blank for no expiry"
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !question.trim() || options.filter((o) => o.text.trim()).length < 2}
            className="w-full"
          >
            Create Poll
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
