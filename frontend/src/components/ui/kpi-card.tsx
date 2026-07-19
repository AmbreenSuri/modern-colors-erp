import * as React from 'react'
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AnimatedNumber } from './animated-number'
import { Skeleton } from './skeleton'

/**
 * The dashboard KPI card.
 *
 * One component for every metric across every role's dashboard, so a figure
 * looks and behaves identically wherever it appears. Numbers count up on load,
 * and a trend chip states the direction in words as well as colour.
 *
 * Trend colour is NOT hard-wired to up=good: for discarded stock, "up" is bad.
 * Callers pass `trendIsGood` to say which direction is healthy for that metric.
 */
export function KpiCard({
  label,
  value,
  decimals = 0,
  suffix,
  sublabel,
  icon: Icon,
  trend,
  trendLabel,
  trendIsGood = true,
  accent = 'primary',
  loading = false,
  className,
}: {
  label: string
  value: number
  decimals?: number
  suffix?: string
  sublabel?: React.ReactNode
  icon?: LucideIcon
  /** Percentage change. Omit when there is no comparison period. */
  trend?: number
  trendLabel?: string
  trendIsGood?: boolean
  accent?: 'primary' | 'amber' | 'violet' | 'healthy' | 'critical' | 'info'
  loading?: boolean
  className?: string
}) {
  const ACCENT: Record<string, string> = {
    primary: 'text-primary [--chip-edge-color:hsl(var(--primary))]',
    amber: 'text-brand-amber [--chip-edge-color:hsl(var(--brand-amber))]',
    violet: 'text-brand-violet [--chip-edge-color:hsl(var(--brand-violet))]',
    healthy: 'text-healthy [--chip-edge-color:hsl(var(--healthy))]',
    critical: 'text-critical [--chip-edge-color:hsl(var(--critical))]',
    info: 'text-info [--chip-edge-color:hsl(var(--info))]',
  }

  if (loading) {
    return (
      <div className={cn('rounded-lg border bg-card p-4 shadow-elev-1', className)}>
        <Skeleton className="h-2.5 w-24" />
        <Skeleton className="mt-3 h-8 w-32" />
        <Skeleton className="mt-3 h-2.5 w-20" />
      </div>
    )
  }

  const dir = trend === undefined ? null : trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat'
  // "Good" means the metric moved the way this particular metric should.
  const good = dir === 'flat' ? null : dir === 'up' ? trendIsGood : !trendIsGood
  const TrendIcon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus

  return (
    <div
      className={cn(
        'chip-edge tactile-lift group relative overflow-hidden rounded-lg border bg-card p-4 pl-5 shadow-elev-1',
        ACCENT[accent],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-label uppercase text-chip-500">{label}</div>
        {Icon && (
          <Icon
            className="h-4 w-4 shrink-0 opacity-40 transition-opacity duration-base group-hover:opacity-70"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          className="text-metric text-chip-900"
        />
        {suffix && <span className="text-sm font-medium text-chip-500">{suffix}</span>}
      </div>

      {(trend !== undefined || sublabel) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {trend !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold',
                good === null && 'bg-chip-100 text-chip-600',
                good === true && 'bg-healthy-surface text-healthy',
                good === false && 'bg-critical-surface text-critical'
              )}
            >
              <TrendIcon className="h-3 w-3" aria-hidden="true" />
              {trend > 0 ? '+' : ''}
              {trend.toFixed(1)}%
            </span>
          )}
          {(trendLabel || sublabel) && (
            <span className="text-xs text-chip-500">{trendLabel ?? sublabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
