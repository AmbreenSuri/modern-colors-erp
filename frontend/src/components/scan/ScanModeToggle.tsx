import { Camera, ScanBarcode } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScanMode } from './useScanMode'

/**
 * Camera vs external-scanner switch.
 *
 * Deliberately a segmented control rather than a dropdown or a settings page: the
 * operator must be able to see which mode they are in at a glance and switch mid-run
 * (scanner battery dies, desk machine has no camera, phone gets paired to a scanner)
 * without navigating away or losing the session count.
 *
 * Small and quiet by default — it sits in the card header, not in the scan surface —
 * but the active side is filled and labelled so the current mode is never ambiguous.
 */
export function ScanModeToggle({
  mode,
  onChange,
  className,
}: {
  mode: ScanMode
  onChange: (m: ScanMode) => void
  className?: string
}) {
  const opts: { value: ScanMode; label: string; icon: typeof Camera; hint: string }[] = [
    { value: 'external', label: 'Scanner', icon: ScanBarcode, hint: 'Use a WiFi or USB barcode scanner' },
    { value: 'camera', label: 'Camera', icon: Camera, hint: 'Use this device’s camera' },
  ]

  return (
    <div
      role="radiogroup"
      aria-label="Scanning method"
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-chip-100 p-0.5',
        className
      )}
    >
      {opts.map(({ value, label, icon: Icon, hint }) => {
        const active = mode === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={hint}
            onClick={(e) => {
              // The parent card refocuses the hidden input on click; don't fight it.
              e.stopPropagation()
              if (!active) onChange(value)
            }}
            className={cn(
              'tactile flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              '[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-3',
              active
                ? 'bg-card text-chip-900 shadow-elev-1'
                : 'text-chip-500 hover:text-chip-700'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
