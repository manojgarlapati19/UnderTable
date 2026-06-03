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
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all duration-150 hover:scale-110',
              hasReacted
                ? 'border-[#C4B5FD] bg-[rgba(196,181,253,0.25)] text-[#DDD6FE]'
                : 'border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] backdrop-blur-[20px] text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.1)] hover:text-white'
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
