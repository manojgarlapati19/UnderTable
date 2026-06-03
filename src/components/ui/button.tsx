import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E1B4B] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary-gradient text-[#2E1065] hover:brightness-110 shadow-lg shadow-[rgba(167,139,250,0.3)]',
        destructive: 'bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/30 border border-[#EF4444]/30',
        outline: 'glass-card text-white hover:bg-[rgba(255,255,255,0.14)]',
        secondary: 'glass-card text-white hover:bg-[rgba(255,255,255,0.14)]',
        ghost: 'text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white',
        link: 'text-[#A78BFA] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 rounded-[13px]',
        sm: 'h-8 rounded-[12px] px-3 text-xs',
        lg: 'h-10 rounded-[13px] px-8',
        icon: 'h-9 w-9 rounded-[11px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
