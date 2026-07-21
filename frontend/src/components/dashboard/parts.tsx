import type { ReactNode } from 'react'
import { AlertTriangle, Boxes, Clock, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Skeleton } from '@/components/ui/skeleton'
import type { AgeingStock, LowStock } from '@/types/api'

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—'

/** Ageing-stock operational panel (FIFO): oldest in-stock units, amber ≥30d / red ≥60d.
 * Shared by the Store and Admin dashboards. */
export function AgeingStockPanel({ ageing }: { ageing: AgeingStock }) {
  if (ageing.units.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" /> Ageing stock
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No ageing stock — oldest unit is {ageing.oldestAgeDays} day{ageing.oldestAgeDays === 1 ? '' : 's'} old
            (flags at {ageing.thresholds.amberDays}d).
          </p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" /> Ageing stock</span>
          {ageing.redCount > 0 && <Badge variant="destructive">{ageing.redCount} old</Badge>}
          {ageing.amberCount > 0 && <Badge className="bg-warning text-warning-foreground hover:bg-warning">{ageing.amberCount} ageing</Badge>}
          <span className="text-xs font-normal text-muted-foreground">use oldest first</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {ageing.units.map((u) => {
            const red = u.level === 'RED'
            return (
              <li key={u.uniqueId} className="flex items-center gap-2 py-1.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${red ? 'bg-critical' : 'bg-warning'}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-mono text-xs text-chip-600">{u.uniqueId}</span> · {u.materialName}
                </span>
                <span className="shrink-0 text-xs text-chip-500">{u.balanceKg} {u.stockUnit}</span>
                <span className={`shrink-0 text-xs font-semibold ${red ? 'text-critical' : 'text-brand-amber'}`}>
                  {u.ageDays}d · {fmtDate(u.arrivedAt)}
                </span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

/** Prominent low-stock alert grid (critical = red, low = amber). Shared by Admin + Store. */
export function LowStockAlerts({ lowStock }: { lowStock: LowStock }) {
  if (lowStock.alerts.length === 0) {
    return (
      <div className="chip-edge flex items-center gap-2 rounded-lg border border-healthy-border bg-healthy-surface py-2.5 pl-4 pr-4 text-sm font-medium text-healthy [--chip-edge-color:hsl(var(--healthy))]">
        <Boxes className="h-4 w-4" /> All materials above the low-stock threshold ({lowStock.thresholds.lowKg} kg).
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        Low-stock alerts
        {lowStock.criticalCount > 0 && <Badge variant="destructive">{lowStock.criticalCount} critical</Badge>}
        {lowStock.lowCount > 0 && (
          <Badge className="bg-warning text-warning-foreground hover:bg-warning">{lowStock.lowCount} low</Badge>
        )}
      </div>
      <div className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lowStock.alerts.map((a) => {
          const critical = a.level === 'CRITICAL'
          return (
            <div
              key={(a.sku ?? a.materialName) + a.level}
              className={`chip-edge tactile-lift flex items-center justify-between rounded-lg border py-2 pl-4 pr-3 ${
                critical
                  ? 'border-critical-border bg-critical-surface [--chip-edge-color:hsl(var(--critical))]'
                  : 'border-warning-border bg-warning-surface [--chip-edge-color:hsl(var(--warning))]'
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-chip-900">{a.materialName}</div>
                <div className="text-xs text-chip-500">
                  {a.sku ?? '—'} · {a.unitCount} unit{a.unitCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className={`shrink-0 text-right ${critical ? 'text-critical' : 'text-brand-amber'}`}>
                <div className="text-xl font-bold leading-none">
                  <AnimatedNumber value={a.totalKg} />
                </div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider">{a.stockUnit} left</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Paint-chip accents: each KPI carries a coloured swatch on its left edge, which
// is what ties the dashboards to the brand without tinting the data itself.
const TONE: Record<string, { text: string; edge: string }> = {
  primary: { text: 'text-primary', edge: '[--chip-edge-color:hsl(var(--primary))]' },
  success: { text: 'text-healthy', edge: '[--chip-edge-color:hsl(var(--healthy))]' },
  info: { text: 'text-info', edge: '[--chip-edge-color:hsl(var(--info))]' },
  danger: { text: 'text-critical', edge: '[--chip-edge-color:hsl(var(--critical))]' },
  amber: { text: 'text-brand-amber', edge: '[--chip-edge-color:hsl(var(--brand-amber))]' },
  violet: { text: 'text-brand-violet', edge: '[--chip-edge-color:hsl(var(--brand-violet))]' },
}

/**
 * Dashboard KPI tile.
 *
 * `value` stays a preformatted string because callers already format units and
 * locale ("1,240 kg", "3 depts"). To still get the count-up animation, a purely
 * numeric value is detected and animated; anything else renders as given.
 */
export function Kpi({
  label,
  value,
  sub,
  tone = 'primary',
}: {
  label: string
  value: string
  sub?: string
  tone?: string
}) {
  const t = TONE[tone] ?? TONE.primary
  // Split a leading number off the string so "1,240 kg" animates the 1,240 and
  // keeps " kg" static. Non-numeric values fall through untouched.
  const m = /^(-?[\d,]+(?:\.\d+)?)(.*)$/.exec(value.trim())
  const numeric = m ? Number(m[1].replace(/,/g, '')) : null
  const decimals = m && m[1].includes('.') ? (m[1].split('.')[1]?.length ?? 0) : 0

  return (
    <Card className={`chip-edge tactile-lift pl-1 ${t.edge}`}>
      <CardContent className="p-4">
        <div className="text-label uppercase text-chip-500">{label}</div>
        <div className={`mt-1.5 text-metric ${t.text}`}>
          {numeric !== null && Number.isFinite(numeric) ? (
            <>
              <AnimatedNumber value={numeric} decimals={decimals} />
              <span className="text-sm font-medium text-chip-500">{m![2]}</span>
            </>
          ) : (
            value
          )}
        </div>
        {sub && <div className="mt-1 text-xs text-chip-500">{sub}</div>}
      </CardContent>
    </Card>
  )
}

export function ChartCard({
  title,
  icon: Icon,
  span2,
  children,
}: {
  title: string
  icon?: LucideIcon
  span2?: boolean
  children: ReactNode
}) {
  return (
    <Card className={span2 ? 'lg:col-span-2' : ''}>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-1.5 text-title-3 text-chip-800">
          {Icon && <Icon className="h-4 w-4 text-chip-400" />} {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">{children}</CardContent>
    </Card>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">{children}</div>
}

export function DashboardSkeleton({ title }: { title: string }) {
  // Mirrors the real dashboard's grid exactly (alert strip, 4 KPIs, 2 charts) so
  // the layout does not shift when the data arrives.
  return (
    <div className="space-y-4">
      <h1 className="text-title-2 text-chip-900">{title}</h1>
      <Skeleton className="h-12 rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 shadow-elev-1">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-3 h-2.5 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 shadow-elev-1">
            <Skeleton className="h-3 w-32" />
            <div className="mt-4 flex h-40 items-end gap-2">
              {[45, 70, 55, 85, 60, 92, 68, 78].map((h, j) => (
                <Skeleton key={j} className="flex-1 rounded-t-sm" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
