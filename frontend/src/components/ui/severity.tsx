import * as React from 'react'
import { AlertTriangle, AlertOctagon, CheckCircle2, Info, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The operational severity language.
 *
 * Low stock, ageing/FIFO, provisional SKUs, pending requests and blocked
 * deductions are all *operational signals* — they must read instantly on a
 * factory floor. Three levels, deliberately separated by HUE rather than
 * lightness, and every one pairs its colour with an ICON and a LABEL so the
 * meaning survives colour-blindness, glare and a cracked phone screen.
 *
 *   critical — act now        (red)    e.g. out of stock, deduction blocked
 *   warning  — needs attention (amber) e.g. ageing stock, partial, provisional
 *   healthy  — all good        (green)  e.g. confirmed, dispatched, in stock
 *   info     — neutral context (blue)   never an alarm
 */
export type Severity = 'critical' | 'warning' | 'healthy' | 'info'

const ICONS: Record<Severity, LucideIcon> = {
  critical: AlertOctagon,
  warning: AlertTriangle,
  healthy: CheckCircle2,
  info: Info,
}

const SURFACE: Record<Severity, string> = {
  critical: 'bg-critical-surface border-critical-border text-critical',
  warning: 'bg-warning-surface border-warning-border text-warning-foreground',
  healthy: 'bg-healthy-surface border-healthy-border text-healthy',
  info: 'bg-info-surface border-info-border text-info',
}

const SOLID: Record<Severity, string> = {
  critical: 'bg-critical text-critical-foreground',
  warning: 'bg-warning text-warning-foreground',
  healthy: 'bg-healthy text-healthy-foreground',
  info: 'bg-info text-info-foreground',
}

const EDGE: Record<Severity, string> = {
  critical: '[--chip-edge-color:hsl(var(--critical))]',
  warning: '[--chip-edge-color:hsl(var(--warning))]',
  healthy: '[--chip-edge-color:hsl(var(--healthy))]',
  info: '[--chip-edge-color:hsl(var(--info))]',
}

/**
 * A compact status pill. Always renders its icon so the state is never carried
 * by colour alone.
 */
export function SeverityBadge({
  severity,
  children,
  solid = false,
  className,
  icon = true,
}: {
  severity: Severity
  children: React.ReactNode
  /** Solid fill for the highest-emphasis cases (e.g. a blocked action). */
  solid?: boolean
  className?: string
  icon?: boolean
}) {
  const Icon = ICONS[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        solid ? cn(SOLID[severity], 'border-transparent') : SURFACE[severity],
        className
      )}
    >
      {icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {children}
    </span>
  )
}

/**
 * A full-width alert row — the "paint chip" shape: a colour swatch bonded to the
 * left edge of a tinted card.
 *
 * `pulse` is reserved for genuinely blocking states. It breathes rather than
 * flashes, so it catches peripheral vision without turning the screen into an
 * alarm panel.
 */
export function SeverityAlert({
  severity,
  title,
  detail,
  action,
  pulse = false,
  className,
}: {
  severity: Severity
  title: React.ReactNode
  detail?: React.ReactNode
  action?: React.ReactNode
  pulse?: boolean
  className?: string
}) {
  const Icon = ICONS[severity]
  return (
    <div
      role={severity === 'critical' ? 'alert' : 'status'}
      className={cn(
        'chip-edge flex items-start gap-3 rounded-lg border p-3 pl-4',
        SURFACE[severity],
        EDGE[severity],
        className
      )}
    >
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', pulse && 'animate-breathe')}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-snug">{title}</div>
        {detail && <div className="mt-0.5 text-xs opacity-80">{detail}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/**
 * Maps stock age in days to a severity, matching the FIFO thresholds already
 * enforced on the server (amber >= 30 days, red >= 60). Kept here so every
 * screen shows the same colour for the same age.
 */
export function ageingSeverity(days: number): Severity {
  if (days >= 60) return 'critical'
  if (days >= 30) return 'warning'
  return 'healthy'
}

/** Stock level vs. its low-stock threshold. */
export function stockSeverity(balanceKg: number, threshold = 0): Severity {
  if (balanceKg <= 0) return 'critical'
  if (threshold > 0 && balanceKg <= threshold) return 'warning'
  return 'healthy'
}
