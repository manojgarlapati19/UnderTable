/**
 * Returns a relative time string (e.g. "2m ago", "1h ago", "yesterday")
 */
export function getRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - then.getTime()
  const isFuture = diffMs < 0
  const absSec = Math.floor(Math.abs(diffMs) / 1000)
  const absMin = Math.floor(absSec / 60)
  const absHr = Math.floor(absMin / 60)
  const absDay = Math.floor(absHr / 24)

  if (absSec < 10) return 'just now'
  if (absSec < 60) return isFuture ? `in ${absSec}s` : `${absSec}s ago`
  if (absMin < 60) return isFuture ? `in ${absMin}m` : `${absMin}m ago`
  if (absHr < 24) return isFuture ? `in ${absHr}h` : `${absHr}h ago`
  if (absDay === 1) return isFuture ? 'tomorrow' : 'yesterday'
  if (absDay < 7) return isFuture ? `in ${absDay}d` : `${absDay}d ago`
  if (absDay < 30) return isFuture ? `in ${Math.floor(absDay / 7)}w` : `${Math.floor(absDay / 7)}w ago`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Returns a full timestamp for tooltips
 */
export function getFullTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Returns a formatted date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Returns a short date for analytics (e.g. "Mon", "Jun 3")
 */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Returns the time in HH:MM format
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}
