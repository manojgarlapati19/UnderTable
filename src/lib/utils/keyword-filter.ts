/**
 * Checks if a message contains any keyword from the blocklist.
 * Returns an array of matched keywords, or empty array if clean.
 */
export function checkKeywordFilter(
  content: string,
  keywords: string[]
): string[] {
  if (!content || !keywords.length) return []

  const lowerContent = content.toLowerCase()
  return keywords.filter((keyword) => {
    const lowerKeyword = keyword.toLowerCase().trim()
    if (!lowerKeyword) return false
    // Use word boundary matching
    const regex = new RegExp(`\\b${escapeRegExp(lowerKeyword)}\\b`, 'i')
    return regex.test(lowerContent)
  })
}

/**
 * Tests a message and returns highlighted segments showing which words match
 */
export function getHighlightedKeywords(
  content: string,
  keywords: string[]
): Array<{ text: string; isMatch: boolean }> {
  if (!content || !keywords.length) return [{ text: content, isMatch: false }]

  const result: Array<{ text: string; isMatch: boolean }> = []
  const lowerContent = content.toLowerCase()
  const matchingKeywords = keywords.filter((kw) => {
    const regex = new RegExp(`\\b${escapeRegExp(kw.toLowerCase().trim())}\\b`, 'i')
    return regex.test(lowerContent)
  })

  if (matchingKeywords.length === 0) {
    return [{ text: content, isMatch: false }]
  }

  // Build a combined regex to match all keywords
  const combinedRegex = new RegExp(
    matchingKeywords
      .map((kw) => `(${escapeRegExp(kw.trim())})`)
      .join('|'),
    'gi'
  )

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ text: content.slice(lastIndex, match.index), isMatch: false })
    }
    result.push({ text: match[0], isMatch: true })
    lastIndex = combinedRegex.lastIndex
  }

  if (lastIndex < content.length) {
    result.push({ text: content.slice(lastIndex), isMatch: false })
  }

  return result.length > 0 ? result : [{ text: content, isMatch: false }]
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
