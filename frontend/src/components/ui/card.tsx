import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift + press response. Use for cards that are actually clickable. */
  interactive?: boolean
  /** Bonds a colour swatch to the left edge — the "paint chip" signature. */
  edge?: 'primary' | 'critical' | 'warning' | 'healthy' | 'info'
}

const EDGE_VAR: Record<NonNullable<CardProps['edge']>, string> = {
  primary: '[--chip-edge-color:hsl(var(--primary))]',
  critical: '[--chip-edge-color:hsl(var(--critical))]',
  warning: '[--chip-edge-color:hsl(var(--warning))]',
  healthy: '[--chip-edge-color:hsl(var(--healthy))]',
  info: '[--chip-edge-color:hsl(var(--info))]',
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, edge, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-elev-1',
        interactive && 'tactile-lift cursor-pointer',
        edge && cn('chip-edge pl-1', EDGE_VAR[edge]),
        className
      )}
      {...props}
    />
  )
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-4', className)} {...props} />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-sm font-semibold leading-none tracking-tight', className)} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-4 pt-0', className)} {...props} />
  )
)
CardContent.displayName = 'CardContent'

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
