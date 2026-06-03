import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#A78BFA] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-gradient text-[#2E1065]',
        secondary: 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.7)]',
        destructive: 'border-transparent bg-[#EF4444]/20 text-[#EF4444]',
        outline: 'text-[rgba(255,255,255,0.7)] border-[rgba(255,255,255,0.12)]',
        success: 'border-transparent bg-[#34D399]/20 text-[#34D399]',
        warning: 'border-transparent bg-[#F59E0B]/20 text-[#F59E0B]',
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
