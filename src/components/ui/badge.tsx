import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent-gradient text-white',
        secondary: 'border-transparent bg-[#13131F] text-[#8888A0] border border-[#22223A]',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-[#8888A0] border-[#22223A]',
        success: 'border-transparent bg-[#22C55E] text-white',
        warning: 'border-transparent bg-[#F59E0B] text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
