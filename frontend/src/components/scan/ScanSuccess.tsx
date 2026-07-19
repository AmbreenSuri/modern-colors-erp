import { CheckCircle2 } from 'lucide-react'

/**
 * The brief confirmation shown between a confirmed action and the camera reopening
 * (~2s). Deliberately large and high-contrast: it is read at arm's length on a factory
 * floor, often through a glove-smudged screen.
 *
 * This is the one moment worth animating properly — an operator sees it hundreds
 * of times a day, and it is their signal that the scan actually committed. Two
 * offset expanding rings plus the tick read as "done" from across a room, and
 * everything is transform/opacity so it stays smooth on a mid-range phone.
 */
export function ScanSuccess({ message, sub }: { message: string; sub?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-scale-in flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-lg border border-healthy-border bg-healthy-surface p-6 text-center"
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span
          aria-hidden="true"
          className="animate-pulse-ring absolute inset-0 rounded-full bg-healthy/30"
        />
        <span
          aria-hidden="true"
          className="animate-pulse-ring absolute inset-0 rounded-full bg-healthy/20"
          style={{ animationDelay: '160ms' }}
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-healthy text-healthy-foreground shadow-elev-3">
          <CheckCircle2 className="h-9 w-9" strokeWidth={2.5} />
        </div>
      </div>
      <p className="text-title-3 text-healthy">{message}</p>
      {sub && <p className="text-sm text-chip-600">{sub}</p>}
      <p className="text-xs text-chip-500">Reopening camera…</p>
    </div>
  )
}
