import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Keyboard, Loader2, ScanLine } from 'lucide-react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScanSuccess } from './ScanSuccess'
import { ScanModeToggle } from './ScanModeToggle'
import { useScanMode } from './useScanMode'
import type { ScanFlow } from './useScanFlow'

const CameraQrScanner = lazy(() =>
  import('./CameraQrScanner').then((m) => ({ default: m.CameraQrScanner })),
)

/**
 * The scan half of a scanning screen: live camera while `flow.isScanning`, the brief
 * success confirmation while `flow.mode === 'success'`, plus the manual/USB-scanner
 * fallback. Rendering the camera CONDITIONALLY (not merely paused) is what releases the
 * device camera between scans.
 */
export function ScanPanel({
  flow,
  title = 'Scan a QR code',
  hint,
  placeholder = 'MC-000001',
  successSub,
  onScan,
}: {
  flow: ScanFlow
  title?: string
  hint?: string
  /** Manual-entry placeholder (hardware scanners type here and press Enter). */
  placeholder?: string
  successSub?: string
  /** Called with the raw decoded text (camera) or the typed value (manual). */
  onScan: (raw: string) => void
}) {
  const { mode: scanMode, setMode: setScanMode, isCamera } = useScanMode()
  const [manual, setManual] = useState('')
  // In external-scanner mode the input IS the scanner target, so it must be open
  // from the start; in camera mode it stays a collapsed fallback.
  const [manualOpen, setManualOpen] = useState(() => scanMode === 'external')
  const inputRef = useRef<HTMLInputElement>(null)

  // After the success flash the loop returns to scanning; if the operator is using a
  // hardware scanner (manual field open), refocus it so the next scan just works.
  useEffect(() => {
    if ((flow.isScanning || !isCamera) && manualOpen) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 50)
      return () => window.clearTimeout(t)
    }
  }, [flow.isScanning, manualOpen, isCamera])

  if (flow.mode === 'success' && flow.successText) {
    return (
      <Card>
        <CardContent className="p-4">
          <ScanSuccess message={flow.successText} sub={successSub} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-2 gap-y-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-title-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-brand/10 text-accent-brand">
            <ScanLine className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        {/* Switchable mid-run; remembered per device and shared with the other
            scan screens. */}
        <ScanModeToggle
          mode={scanMode}
          onChange={(m) => {
            setScanMode(m)
            if (m === 'external') {
              // Jumping to the scanner should land the operator ready to scan,
              // not staring at a collapsed "enter manually" link.
              setManualOpen(true)
              setTimeout(() => inputRef.current?.focus(), 60)
            }
          }}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {/* In EXTERNAL mode the camera component is not rendered at all. Merely hiding
            it would keep the media track open — an unrequested permission prompt and a
            flat battery by mid-shift. */}
        {isCamera ? (
          <>
            <ErrorBoundary
              fallback={
                <div className="rounded-lg border border-warning-border bg-warning-surface p-6 text-center text-sm text-warning-foreground">
                  Camera unavailable on this device — switch to Scanner above.
                </div>
              }
            >
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-chip-50 py-12 text-sm text-chip-500">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    Loading scanner…
                  </div>
                }
              >
                {/* Mounted only while scanning — unmounting stops + releases the camera. */}
                <CameraQrScanner onResult={onScan} />
              </Suspense>
            </ErrorBoundary>
            {hint && <p className="text-center text-xs text-chip-500">{hint}</p>}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-chip-300 bg-chip-50 p-6 text-center">
            <ScanLine className="h-8 w-8 animate-breathe text-chip-400" aria-hidden="true" />
            <p className="mt-2.5 text-title-3 text-chip-700">Ready to scan</p>
            <p className="mt-1 text-sm text-chip-500">
              Scan a label with your barcode scanner — the code lands in the box below.
            </p>
          </div>
        )}

        {manualOpen ? (
          <form
            className="flex gap-2 border-t pt-3"
            onSubmit={(e) => {
              e.preventDefault()
              const v = manual.trim()
              if (!v) return
              setManual('')
              onScan(v)
            }}
          >
            <Input
              ref={inputRef}
              autoFocus
              placeholder={placeholder}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              className="h-11"
            />
            <Button type="submit" variant="outline" className="h-11" disabled={!manual.trim()}>
              Go
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="tactile flex min-h-11 w-full items-center justify-center gap-1.5 border-t pt-3 text-xs font-medium text-chip-500 hover:text-primary"
          >
            <Keyboard className="h-3.5 w-3.5" /> Enter code manually (USB scanner / typing)
          </button>
        )}
      </CardContent>
    </Card>
  )
}
