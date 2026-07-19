import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import {
  ScanLine,
  Keyboard,
  Loader2,
  Truck,
  PackageCheck,
  CheckCircle2,
  Boxes,
  RotateCcw,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import type { DispatchHistory, DispatchReady, FinishedGood } from '@/types/api'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog'
import { toast } from '@/hooks/useToast'

const CameraQrScanner = lazy(() =>
  import('@/components/scan/CameraQrScanner').then((m) => ({ default: m.CameraQrScanner })),
)

const DEVICE = 'web-client'

// FG QR payload is JSON ({ uniqueId, ... }); fall back to raw text for a typed code.
function extractUniqueId(text: string): string {
  try {
    const o = JSON.parse(text)
    if (o && typeof o.uniqueId === 'string') return o.uniqueId
  } catch {
    /* not JSON */
  }
  return text.trim()
}

export function DispatchPage() {
  const { user } = useAuth()
  const [ready, setReady] = useState<DispatchReady | null>(null)
  const [history, setHistory] = useState<DispatchHistory | null>(null)
  const [last, setLast] = useState<FinishedGood | null>(null)
  const [manual, setManual] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [bulkTarget, setBulkTarget] = useState<DispatchReady['batches'][number] | null>(null)

  const load = useCallback(async () => {
    const [r, h] = await Promise.all([
      api.get<DispatchReady>('/finished-goods/dispatch/ready').catch(() => null),
      api.get<DispatchHistory>('/finished-goods/dispatch/history').catch(() => null),
    ])
    setReady(r)
    setHistory(h)
  }, [])
  useEffect(() => void load(), [load])

  const scan = async (raw: string) => {
    const id = extractUniqueId(raw)
    if (!id || busy) return
    setBusy(true)
    try {
      const unit = await api.post<FinishedGood>('/finished-goods/dispatch/scan', {
        uniqueId: id,
        device: DEVICE,
      })
      setLast(unit)
      setManual('')
      toast({ title: `${unit.uniqueId} dispatched`, description: `${unit.productName} · batch ${unit.batch?.batchNumber}` })
      await load()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Not dispatched',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const dispatchWholeBatch = async () => {
    if (!bulkTarget) return
    setBusy(true)
    try {
      const res = await api.post<{ dispatched: number }>('/finished-goods/dispatch/batch', {
        batchId: bulkTarget.batchId,
      })
      toast({ title: `${res.dispatched} units dispatched`, description: `Batch ${bulkTarget.batchNumber}` })
      setBulkTarget(null)
      await load()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not dispatch batch', description: err instanceof ApiError ? err.message : '' })
    } finally {
      setBusy(false)
    }
  }

  if (user?.role !== 'DISPATCH') {
    return <EmptyState title="Dispatch" description="This screen is for the dispatch team." />
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {/* Today's tally */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Dispatched today</div>
            <div className="mt-1 text-2xl font-semibold text-success">{history?.todayCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Awaiting dispatch</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{history?.totalPending ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-4 w-4" /> Scan a finished-goods QR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ErrorBoundary
            fallback={
              <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Camera unavailable — use manual entry below.
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/30 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading scanner…
                </div>
              }
            >
              <CameraQrScanner paused={busy} onResult={(t) => scan(t)} />
            </Suspense>
          </ErrorBoundary>

          {manualOpen ? (
            <form
              className="flex gap-2 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                scan(manual)
              }}
            >
              <Input placeholder="FG-000001" value={manual} onChange={(e) => setManual(e.target.value)} />
              <Button type="submit" variant="outline" disabled={busy || !manual.trim()}>
                Dispatch
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 border-t pt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              <Keyboard className="h-3.5 w-3.5" /> Enter FG code manually
            </button>
          )}
        </CardContent>
      </Card>

      {/* Last dispatched confirmation */}
      {last && (
        <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/10 p-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-semibold text-success">{last.uniqueId} dispatched</div>
            <div className="text-muted-foreground">
              {last.productName} · {last.sizePerPackage} {last.sizeUnit} · batch {last.batch?.batchNumber}
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setLast(null)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Ready for dispatch, grouped by batch */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-base">
            <Boxes className="h-4 w-4" /> Ready for dispatch
            {ready ? <Badge variant="outline" className="ml-1">{ready.total}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!ready || ready.batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting — everything produced has been dispatched.</p>
          ) : (
            <ul className="divide-y">
              {ready.batches.map((b) => (
                <li key={b.batchId} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{b.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      Batch {b.batchNumber} · {b.department} ·{' '}
                      <span className="font-medium text-foreground">{b.pending} pending</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkTarget(b)} disabled={busy}>
                    <Truck className="h-4 w-4" /> Dispatch all {b.pending}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent history */}
      {history && history.recent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <PackageCheck className="h-4 w-4" /> Recently dispatched
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {history.recent.slice(0, 10).map((u) => (
                <li key={u.id} className="flex items-center gap-2 py-1.5">
                  <span className="font-mono text-xs">{u.uniqueId}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {u.productName} · {u.batch?.batchNumber}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {u.dispatchedAt?.slice(5, 16).replace('T', ' ')}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ConfirmationDialog
        open={!!bulkTarget}
        onOpenChange={(v) => !v && setBulkTarget(null)}
        title="Dispatch the whole batch?"
        description={
          bulkTarget
            ? `This marks all ${bulkTarget.pending} remaining unit(s) of batch ${bulkTarget.batchNumber} (${bulkTarget.productName}) as dispatched. It is recorded as a bulk dispatch in the audit trail.`
            : ''
        }
        confirmLabel="Dispatch all"
        onConfirm={dispatchWholeBatch}
      />
    </div>
  )
}
