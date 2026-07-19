import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART } from './chartTheme'

const AXIS = { stroke: CHART.axis, fontSize: 11, tickLine: false, axisLine: false } as const

function box(): React.CSSProperties {
  return {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 'var(--radius)',
    fontSize: 12,
    padding: '8px 12px',
    // Warm-tinted elevation, matching the card shadows rather than a neutral black.
    boxShadow: 'var(--elev-3)',
  }
}

const KG = (v: number | string) => `${v} kg`
const shortDay = (d: string) => d.slice(5) // MM-DD

/**
 * Shared entrance animation for every chart.
 *
 * Charts draw themselves in on first paint, which makes a dashboard feel alive
 * instead of pasted-in. Recharts animates on the main thread, so this is kept
 * short and is disabled outright under prefers-reduced-motion — an animating
 * chart is exactly the kind of motion that setting exists to suppress.
 */
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export const ANIM = {
  isAnimationActive: !prefersReducedMotion,
  animationDuration: 700,
  animationEasing: 'ease-out',
} as const

/** Stacked area trend of stock movements over time (add / deduct / discard). */
export function MovementTrend({
  data,
  keys = ['ADD', 'DEDUCT', 'DISCARD'],
  height = 220,
}: {
  data: { date: string; ADD: number; DEDUCT: number; DISCARD: number }[]
  keys?: ('ADD' | 'DEDUCT' | 'DISCARD')[]
  height?: number
}) {
  const color = { ADD: CHART.add, DEDUCT: CHART.deduct, DISCARD: CHART.discard }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {keys.map((k) => (
            <linearGradient key={k} id={`g-${k}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color[k]} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color[k]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDay} {...AXIS} minTickGap={24} />
        <YAxis {...AXIS} width={40} />
        <Tooltip
          contentStyle={box()}
          formatter={(v: number) => KG(v)}
          cursor={{ stroke: CHART.axis, strokeWidth: 1, strokeDasharray: '4 4' }}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        {keys.map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            name={k[0] + k.slice(1).toLowerCase()}
            stroke={color[k]}
            strokeWidth={2}
            fill={`url(#g-${k})`}
            // Series draw in sequence so the eye follows one line at a time.
            {...ANIM}
            animationBegin={i * 110}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Simple horizontal-friendly vertical bar chart with per-bar colors. */
export function CategoryBars({
  data,
  height = 200,
  colorFor,
}: {
  data: { label: string; value: number }[]
  height?: number
  colorFor?: (label: string, i: number) => string
}) {
  const fillOf = (label: string, i: number) =>
    colorFor ? colorFor(label, i) : CHART.categorical[i % CHART.categorical.length]

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        {/* Vertical gradient per bar. Flat brand colour at full height reads as
            shouting; fading toward the base gives depth and lets the data lead. */}
        <defs>
          {data.map((d, i) => {
            const c = fillOf(d.label, i)
            return (
              <linearGradient key={d.label} id={`bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.95} />
                <stop offset="100%" stopColor={c} stopOpacity={0.55} />
              </linearGradient>
            )
          })}
        </defs>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={0} />
        <YAxis {...AXIS} width={40} />
        <Tooltip contentStyle={box()} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} formatter={(v: number) => KG(v)} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64} {...ANIM}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={`url(#bar-${i})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Donut for a categorical breakdown (e.g. requests by status). */
export function Donut({
  data,
  height = 200,
  colorFor,
}: {
  data: { label: string; value: number }[]
  height?: number
  colorFor?: (label: string, i: number) => string
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No data yet</div>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
          // Sweeps open from 90° so the ring draws clockwise from the top.
          startAngle={90}
          endAngle={-270}
          {...ANIM}
        >
          {data.map((d, i) => (
            <Cell
              key={d.label}
              fill={colorFor ? colorFor(d.label, i) : CHART.categorical[i % CHART.categorical.length]}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          ))}
          {/* The hole is wasted space otherwise — put the total in it. */}
          <Label
            position="center"
            content={({ viewBox }) => {
              const vb = viewBox as { cx?: number; cy?: number } | undefined
              if (!vb?.cx || !vb?.cy) return null
              return (
                <g>
                  <text
                    x={vb.cx}
                    y={vb.cy - 4}
                    textAnchor="middle"
                    className="fill-chip-900"
                    style={{ fontSize: 20, fontWeight: 700 }}
                  >
                    {total.toLocaleString('en-IN')}
                  </text>
                  <text
                    x={vb.cx}
                    y={vb.cy + 13}
                    textAnchor="middle"
                    className="fill-chip-500"
                    style={{ fontSize: 10, letterSpacing: '0.08em' }}
                  >
                    TOTAL
                  </text>
                </g>
              )
            }}
          />
        </Pie>
        <Tooltip contentStyle={box()} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Grouped requested-vs-issued bars per department (fulfilment). */
export function FulfilmentBars({
  data,
  height = 200,
}: {
  data: { label: string; requested: number; issued: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="ful-req" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.categorical[0]} stopOpacity={0.9} />
            <stop offset="100%" stopColor={CHART.categorical[0]} stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="ful-iss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.add} stopOpacity={0.9} />
            <stop offset="100%" stopColor={CHART.add} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" {...AXIS} interval={0} />
        <YAxis {...AXIS} width={40} />
        <Tooltip contentStyle={box()} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} formatter={(v: number) => KG(v)} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Bar
          dataKey="requested"
          name="Requested"
          fill="url(#ful-req)"
          radius={[6, 6, 0, 0]}
          maxBarSize={44}
          {...ANIM}
        />
        <Bar
          dataKey="issued"
          name="Issued"
          fill="url(#ful-iss)"
          radius={[6, 6, 0, 0]}
          maxBarSize={44}
          {...ANIM}
          animationBegin={120}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Thin wrapper to lazy-render charts only when they scroll into view isn't needed here;
 * charts are light. Exported for a consistent empty state. */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">{children}</div>
}
