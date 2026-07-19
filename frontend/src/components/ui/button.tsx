import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // `tactile` (styles/motion.css) adds the press-scale + spring release that makes
  // a click feel weighted rather than flat. Shadows step up on hover and collapse
  // on press, so the button reads as physically pushed into the surface.
  'tactile inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-elev-1 hover:bg-primary/90 hover:shadow-elev-2 active:shadow-none',
        destructive:
          'bg-destructive text-destructive-foreground shadow-elev-1 hover:bg-destructive/90 hover:shadow-elev-2 active:shadow-none',
        outline:
          'border border-input bg-background hover:border-primary/30 hover:bg-accent hover:text-accent-foreground hover:shadow-elev-1 active:shadow-none',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-elev-1 active:shadow-none',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // High-emphasis confirm actions (issue stock, confirm output, dispatch).
        healthy:
          'bg-healthy text-healthy-foreground shadow-elev-1 hover:bg-healthy/90 hover:shadow-elev-2 active:shadow-none',
      },
      size: {
        // Touch devices get a 44px minimum tap target (gloved hands on the factory
        // floor); pointer devices keep the original compact sizing exactly.
        default: 'h-9 px-4 py-2 [@media(pointer:coarse)]:min-h-11',
        sm: 'h-8 rounded-md px-3 text-xs [@media(pointer:coarse)]:min-h-10',
        lg: 'h-10 rounded-md px-8 [@media(pointer:coarse)]:min-h-11',
        icon: 'h-9 w-9 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11',
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
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
