import jsPDF from 'jspdf'

interface ExportMessage {
  id: string
  senderLabel: string // Randomised per export (Member A, Member B, etc.)
  content: string
  timestamp: string
}

interface ReactionSummary {
  emoji: string
  count: number
}

interface RoomDigestData {
  roomName: string
  roomEmoji: string
  dateRange: string
  messages: ExportMessage[]
  reactionSummary: ReactionSummary[]
}

/**
 * Generates a PDF digest of a room's messages with anonymized sender names.
 * Member labels are randomised per export for privacy.
 */
export function generateRoomDigestPDF(data: RoomDigestData): Blob {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Header
  doc.setFontSize(24)
  doc.setTextColor(124, 58, 237) // Violet accent #7C3AED
  doc.text('UnderTable', margin, y)
  y += 8

  doc.setFontSize(14)
  doc.setTextColor(15, 23, 42) // Deep navy #0F172A
  doc.text(`${data.roomEmoji} ${data.roomName}`, margin, y)
  y += 7

  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139) // Slate-500
  doc.text(`Table Top Tech — Room Digest`, margin, y)
  y += 5
  doc.text(`Period: ${data.dateRange}`, margin, y)
  y += 10

  // Separator line
  doc.setDrawColor(124, 58, 237)
  doc.setLineWidth(1)
  doc.line(margin, y, pageWidth - margin, y)
  y += 10

  // Messages
  doc.setFontSize(10)
  for (const msg of data.messages) {
    // Check if we need a new page
    if (y > 270) {
      doc.addPage()
      y = margin
    }

    // Sender label + timestamp
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(`${msg.senderLabel}`, margin, y)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    const timeX = margin + doc.getTextWidth(`${msg.senderLabel}`) + 5
    doc.text(msg.timestamp, timeX, y)
    y += 5

    // Message content - word wrap
    doc.setTextColor(51, 65, 85) // Slate-700
    const lines = doc.splitTextToSize(msg.content, contentWidth)
    doc.text(lines, margin, y)
    y += lines.length * 5 + 5
  }

  // Reactions summary
  if (data.reactionSummary.length > 0) {
    if (y > 240) {
      doc.addPage()
      y = margin
    }

    y += 5
    doc.setDrawColor(124, 58, 237)
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    y += 10

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(15, 23, 42)
    doc.text('Reactions Summary', margin, y)
    y += 8

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    for (const reaction of data.reactionSummary) {
      doc.text(`${reaction.emoji} × ${reaction.count}`, margin, y)
      y += 7
    }
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184) // Slate-400
    doc.text(
      `UnderTable — Generated ${new Date().toLocaleDateString()}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    )
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin - 30,
      doc.internal.pageSize.getHeight() - 10
    )
  }

  return doc.output('blob')
}

/**
 * Fisher-Yates (Knuth) shuffle — unbiased O(n) in-place shuffle.
 */
function fisherYatesShuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateAnonymousLabels(
  messageUserIds: string[]
): Map<string, string> {
  const uniqueIds = [...new Set(messageUserIds)]
  const shuffled = fisherYatesShuffle(uniqueIds)
  const labels = new Map<string, string>()

  shuffled.forEach((id, index) => {
    labels.set(id, `Member ${String.fromCharCode(65 + (index % 26))}`)
  })

  return labels
}
