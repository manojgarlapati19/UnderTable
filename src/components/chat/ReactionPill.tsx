'use client'

import { cn } from '@/lib/utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ReactionPillProps {
  emoji: string
  count: number
  hasReacted: boolean
  reactorNames: string[]
  onToggle: () => void
}

export default function ReactionPill({
  emoji,
  count,
  hasReacted,
  reactorNames,
  onToggle,
}: ReactionPillProps) {
  const tooltipText =
    reactorNames.length > 0
      ? `Reacted by: ${reactorNames.slice(0, 5).join(', ')}${reactorNames.length > 5 ? ` +${reactorNames.length - 5} more` : ''}`
      : 'No reactions yet'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggle}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all hover:scale-105',
              hasReacted
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-sidebar-hover'
            )}
          >
            <span>{emoji}</span>
            <span className="font-medium">{count}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
