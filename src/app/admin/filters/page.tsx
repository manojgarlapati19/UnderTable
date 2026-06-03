'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, X, Loader2, AlertTriangle } from 'lucide-react'
import { checkKeywordFilter, getHighlightedKeywords } from '@/lib/utils/keyword-filter'
import { toast } from 'sonner'
import type { Tables } from '@/lib/supabase/database.types'

export default function AdminFiltersPage() {
  const supabase = createClient()
  const [keywords, setKeywords] = useState<Tables<'keyword_filters'>[]>([])
  const [newWord, setNewWord] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const keywordList = keywords.map((k) => k.word)

  useEffect(() => {
    loadKeywords()
  }, [])

  async function loadKeywords() {
    const { data } = await supabase
      .from('keyword_filters')
      .select('*')
      .order('word')

    if (data) setKeywords(data)
    setLoading(false)
  }

  async function addKeyword() {
    if (!newWord.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('keyword_filters').insert({
      word: newWord.trim().toLowerCase(),
      created_by: user.id,
    })

    if (!error) {
      toast.success(`Added "${newWord}" to filter list`)
      setNewWord('')
      loadKeywords()
    } else {
      toast.error(error.message)
    }
  }

  async function removeKeyword(id: string) {
    const { error } = await supabase.from('keyword_filters').delete().eq('id', id)
    if (!error) {
      toast.success('Keyword removed')
      loadKeywords()
    }
  }

  const testHighlights = testMessage ? getHighlightedKeywords(testMessage, keywordList) : []

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#A78BFA]" /></div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-medium text-white">Keyword Filters</h1>

      <div className="space-y-3">
        <Label>Current Blocklist</Label>
        <div className="flex flex-wrap gap-2 p-4 glass-card rounded-[14px] min-h-10">
          {keywords.length === 0 ? (
            <p className="text-sm text-[#56566E]">No keywords added yet</p>
          ) : (
            keywords.map((kw) => (
              <Badge key={kw.id} variant="secondary" className="gap-1 text-sm px-3 py-1">
                {kw.word}
                <button onClick={() => removeKeyword(kw.id)} className="ml-1 hover:text-red-400">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="newWord">Add Keyword</Label>
          <Input
            id="newWord"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            placeholder="Enter a word or phrase to filter"
          />
        </div>
        <Button onClick={addKeyword} disabled={!newWord.trim()}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      <div className="space-y-3 glass-card rounded-[14px] p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-[#56566E]" />
          <Label>Test a Message</Label>
        </div>
        <Textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="Paste a message to test which keywords would be caught..."
          rows={3}
        />
        {testHighlights.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
              <span className="font-medium text-[#F59E0B]">Flagged words found:</span>
            </div>
            <div className="rounded-[12px] bg-[#0B0B14] p-3 text-sm text-white">
              {testHighlights.map((part, i) =>
                part.isMatch ? (
                  <span key={i} className="bg-red-900/30 text-red-400 px-1 rounded">
                    {part.text}
                  </span>
                ) : (
                  <span key={i}>{part.text}</span>
                )
              )}
            </div>
          </div>
        )}
        {testMessage && testHighlights.length === 0 && (
          <p className="text-sm text-[#22C55E]">No flagged words found ✓</p>
        )}
      </div>
    </div>
  )
}
