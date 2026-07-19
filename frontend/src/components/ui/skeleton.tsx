import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Loading placeholders.
 *
 * These deliberately mirror the SHAPE of the content that replaces them — a
 * table skeleton has the same row rhythm as the real table — so the page does
 * not jump when data lands. That stability is most of what makes loading feel
 * fast rather than broken.
 *
 * The base `Skeleton` keeps its original props signature so existing callers
 * are unaffected; only the shimmer treatment changed (see .skeleton in
 * styles/motion.css, which animates a transform rather than a background
 * position, so it does not repaint the block every frame).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton', className)} aria-hidden="true" {...props} />
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

/** Matches the KPI card layout: label, big metric, trend line. */
function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 shadow-elev-1', className)} aria-hidden="true">
      <Skeleton className="h-2.5 w-24" />
      <Skeleton className="mt-3 h-8 w-32" />
      <Skeleton className="mt-3 h-2.5 w-20" />
    </div>
  )
}

/** Matches a data table: header rule + evenly spaced rows. */
function SkeletonTable({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number
  cols?: number
  className?: string
}) {
  return (
    <div className={cn('w-full', className)} aria-hidden="true">
      <div className="flex gap-4 border-b pb-2.5">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="stagger">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 border-b py-3.5 last:border-0">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-[40%]')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function SkeletonChart({ className }: { className?: string }) {
  // Fixed bar heights: a random pattern would reshuffle on every render and
  // read as flickering rather than loading.
  const heights = [45, 70, 55, 85, 60, 92, 68, 78, 50, 88]
  return (
    <div className={cn('flex h-full items-end gap-2', className)} aria-hidden="true">
      {heights.map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonKpi, SkeletonTable, SkeletonChart }
