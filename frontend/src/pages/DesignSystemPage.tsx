import { useState } from 'react'
import { Package, TrendingUp, Layers, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { KpiCard } from '@/components/ui/kpi-card'
import { SeverityAlert, SeverityBadge } from '@/components/ui/severity'
import { Skeleton, SkeletonKpi, SkeletonTable } from '@/components/ui/skeleton'
import { LogoLockup, LogoMark, TaglineStrip } from '@/components/brand/Logo'
import { AnimatedNumber } from '@/components/ui/animated-number'

/**
 * Living design-system reference for the "Paint Chip" direction.
 *
 * Dev-only: this route exists so the design language can be reviewed and
 * regression-checked in one place rather than by hunting across screens. It is
 * excluded from the production build (see App.tsx) so it never ships to the
 * factory or appears in the sidebar.
 */
export function DesignSystemPage() {
  const [n, setN] = useState(1240)

  const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <section className="space-y-3">
      <div>
        <h2 className="text-title-3 text-chip-900">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-chip-500">{hint}</p>}
      </div>
      {children}
    </section>
  )

  const swatches = [
    ['brand-red', 'Primary · logo red', 'bg-brand-red'],
    ['brand-amber', 'Accent · warm amber', 'bg-brand-amber'],
    ['brand-violet', 'Accent · logo violet', 'bg-brand-violet'],
    ['brand-yellow', 'Logo yellow', 'bg-brand-yellow'],
  ] as const

  // Full class names, not `bg-chip-${k}` — Tailwind scans source statically and
  // cannot see class names built at runtime.
  const neutrals = [
    ['50', 'bg-chip-50'],
    ['100', 'bg-chip-100'],
    ['200', 'bg-chip-200'],
    ['300', 'bg-chip-300'],
    ['400', 'bg-chip-400'],
    ['500', 'bg-chip-500'],
    ['600', 'bg-chip-600'],
    ['700', 'bg-chip-700'],
    ['800', 'bg-chip-800'],
    ['900', 'bg-chip-900'],
    ['950', 'bg-chip-950'],
  ] as const

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <LogoLockup subtitle="Design system" />
          <span className="rounded-full bg-chip-100 px-2.5 py-1 text-label uppercase text-chip-600">
            Paint Chip
          </span>
        </div>
        <TaglineStrip className="border-t py-2" />
      </header>

      <main className="mx-auto max-w-5xl space-y-12 p-6">
        {/* ---------------------------------------------------------------- */}
        <Section title="Logo" hint="Geometric mark holds shape down to 16px; the traced lockup is for large use.">
          <Card>
            <CardContent className="flex flex-wrap items-end gap-8 p-6">
              <LogoMark className="h-16 w-16" />
              <LogoMark className="h-10 w-10" />
              <LogoMark className="h-6 w-6" />
              <LogoMark className="h-4 w-4" />
              <div className="rounded-lg bg-chip-950 p-5">
                <LogoLockup tone="light" subtitle="Oversight" />
              </div>
            </CardContent>
          </Card>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Colour" hint="Brand hues sampled from the logo; neutrals warmed toward red so white space reads as paper.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {swatches.map(([name, label, bg]) => (
              <div key={name} className="overflow-hidden rounded-lg border shadow-elev-1">
                <div className={`h-20 ${bg}`} />
                <div className="bg-card p-3">
                  <div className="text-sm font-semibold text-chip-900">{label}</div>
                  <code className="text-xs text-chip-500">{name}</code>
                </div>
              </div>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-lg border shadow-elev-1">
            {neutrals.map(([k, bg]) => (
              <div key={k} className="flex-1">
                <div className={`h-12 ${bg}`} />
                <div className="bg-card py-1.5 text-center text-[10px] text-chip-500">{k}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section
          title="Severity language"
          hint="Three levels separated by hue, always paired with an icon and a label so meaning never rests on colour alone."
        >
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity="critical">Out of stock</SeverityBadge>
            <SeverityBadge severity="warning">Ageing · 42 days</SeverityBadge>
            <SeverityBadge severity="healthy">In stock</SeverityBadge>
            <SeverityBadge severity="info">Provisional SKU</SeverityBadge>
            <SeverityBadge severity="critical" solid>
              Deduction blocked
            </SeverityBadge>
          </div>
          <div className="space-y-2">
            <SeverityAlert
              severity="critical"
              title="Calcium Carbonate — 2 kg remaining"
              detail="Below the low-stock threshold. Raise a purchase order."
              pulse
              action={<Button size="sm" variant="outline">View</Button>}
            />
            <SeverityAlert
              severity="warning"
              title="6 units older than 30 days"
              detail="FIFO suggests issuing MC-000118 before newer stock."
            />
            <SeverityAlert severity="healthy" title="All 12 batches confirmed" detail="Nothing awaiting review." />
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="KPI cards" hint="Numbers count up; trend colour reflects whether the metric moved the right way.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="In-hand stock" value={1240} suffix="kg" icon={Package} trend={12.4} trendLabel="vs last month" />
            <KpiCard label="Issued 30d" value={612} suffix="kg" icon={TrendingUp} trend={-4.2} trendLabel="vs last month" accent="info" />
            <KpiCard label="Discarded" value={18} suffix="kg" icon={Layers} trend={8.1} trendIsGood={false} trendLabel="more waste" accent="critical" />
            <KpiCard label="Dispatched" value={86} suffix="drums" icon={Truck} trend={0} trendLabel="flat" accent="healthy" />
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Motion" hint="Press any button — everything clickable gives weight back. Numbers animate on change.">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 p-6">
              <Button onClick={() => setN(Math.round(Math.random() * 4000))}>Randomise number</Button>
              <Button variant="outline" onClick={() => setN(0)}>Reset</Button>
              <Button variant="healthy">Confirm</Button>
              <Button variant="destructive">Discard</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <div className="ml-auto text-metric text-chip-900">
                <AnimatedNumber value={n} suffix=" kg" />
              </div>
            </CardContent>
          </Card>
          <div className="stagger grid gap-3 sm:grid-cols-3">
            {['Staggered', 'entrance', 'cascade'].map((t) => (
              <Card key={t} interactive edge="primary">
                <CardContent className="p-4 text-sm font-medium">{t}</CardContent>
              </Card>
            ))}
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Elevation" hint="Five warm-tinted layers — cards feel like paper on paper, not glass on grey.">
          <div className="grid gap-4 sm:grid-cols-5">
            {([
              ['1', 'shadow-elev-1'],
              ['2', 'shadow-elev-2'],
              ['3', 'shadow-elev-3'],
              ['4', 'shadow-elev-4'],
              ['5', 'shadow-elev-5'],
            ] as const).map(([l, sh]) => (
              <div key={l} className={`rounded-lg bg-card p-4 text-center text-sm ${sh}`}>
                elev-{l}
              </div>
            ))}
          </div>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Loading" hint="Skeletons mirror the shape of real content so nothing jumps when data lands.">
          <div className="grid gap-3 sm:grid-cols-3">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Table skeleton</CardTitle>
            </CardHeader>
            <CardContent>
              <SkeletonTable rows={4} cols={5} />
            </CardContent>
          </Card>
        </Section>

        {/* ---------------------------------------------------------------- */}
        <Section title="Forms" hint="44px targets on touch devices; focus rings in brand red.">
          <Card>
            <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Material</label>
                <Input placeholder="Search the catalogue…" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Quantity (kg)</label>
                <Input type="number" placeholder="0" className="h-11" />
              </div>
            </CardContent>
          </Card>
        </Section>

        <div className="py-8 text-center text-xs text-chip-400">
          <Skeleton className="mx-auto mb-4 h-px w-24" />
          Paint Chip · Modern Colours design system
        </div>
      </main>
    </div>
  )
}
