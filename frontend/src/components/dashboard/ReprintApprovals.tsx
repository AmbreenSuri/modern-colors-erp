import { useCallback, useEffect, useState } from 'react'
import { Printer, Check, X, Clock, Lock } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { toast } from '@/hooks/useToast'
import { useAutoRefresh } from '@/lib/refresh'
import type { ReprintRequest } from '@/types/api'

/** What the request is actually about, in words the owner recognises. */
function describe(r: ReprintRequest): string {
  if (r.po) return `Invoice ${r.po.poNumber ?? '—'}${r.po.supplier ? ` · ${r.po.supplier}` : ''} — all unit labels`
  if (r.material) return `${r.material.uniqueId} · ${r.material.materialName} — one unit label`
  if (r.output) return `Batch ${r.output.batch.batchNumber} · ${r.output.productName} — all drum labels`
  if (r.finishedGood) return `${r.finishedGood.uniqueId} · ${r.finishedGood.productName} — one drum label`
  return 'Labels'
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-warning text-warning-foreground hover:bg-warning',
  APPROVED: 'bg-healthy text-success-foreground hover:bg-healthy',
  REJECTED: 'bg-destructive text-destructive-foreground hover:bg-destructive',
  CONSUMED: '',
}

/**
 * The factory Admin's reprint queue — the third named door, from his side.
 *
 * Reprinting is the one way a duplicate sticker reaches the floor, so approving is
 * deliberately a decision rather than a click: he says HOW MANY prints it buys, and
 * the lock closes again when they are used.
 */
export function ReprintApprovals() {
  const [rows, setRows] = useState<ReprintRequest[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [prints, setPrints] = useState<Record<string, string>>({})

  const load = useCallback(
    () => api.get<ReprintRequest[]>('/label-reprints').then(setRows).catch(() => setRows([])),
    [],
  )
  useEffect(() => void load(), [load])
  useAutoRefresh(load, { intervalMs: 30_000 })

  const decide = async (r: ReprintRequest, action: 'approve' | 'reject') => {
    setBusy(true)
    try {
      const n = Math.max(1, Math.min(100, Number(prints[r.id] || 1)))
      await api.post(`/label-reprints/decisions/${r.id}/${action}`, action === 'approve' ? { prints: n } : {})
      toast({
        title: action === 'approve' ? `Approved — ${n} print${n === 1 ? '' : 's'}` : 'Reprint rejected',
      })
      await load()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Refused',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!rows) return <p className="text-sm text-chip-500">Loading…</p>

  const pending = rows.filter((r) => r.status === 'PENDING')
  const rest = rows.filter((r) => r.status !== 'PENDING')

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-1.5 text-sm text-chip-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        Labels print once without asking. Printing the same labels again needs your approval — you
        decide how many prints it allows, and the lock closes again when they are used.
      </p>

      {pending.length === 0 ? (
        <EmptyState icon={Printer} title="Nothing waiting" description="No one is asking to reprint labels." />
      ) : (
        <div className="stagger grid gap-2">
          {pending.map((r) => (
            <Card key={r.id} edge="warning">
              <CardContent className="space-y-3 p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-chip-900">{describe(r)}</p>
                  <p className="mt-1 text-sm italic text-chip-600">“{r.reason}”</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-chip-500">
                    <Clock className="h-3 w-3" />
                    {r.requestedBy?.name ?? r.requestedBy?.email ?? 'Unknown'} ·{' '}
                    {r.requestedAt.slice(0, 16).replace('T', ' ')}
                  </p>
                </div>
                {/* Stacks on a phone: the number is a real decision, not an afterthought. */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor={`n-${r.id}`}>How many prints?</Label>
                    <Input
                      id={`n-${r.id}`}
                      type="number"
                      min={1}
                      max={100}
                      inputMode="numeric"
                      value={prints[r.id] ?? '1'}
                      onChange={(e) => setPrints((p) => ({ ...p, [r.id]: e.target.value }))}
                      className="h-11 w-full sm:w-28"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button className="h-11 flex-1 gap-1.5 sm:flex-none" disabled={busy} onClick={() => void decide(r, 'approve')}>
                      <Check className="h-4 w-4" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 flex-1 gap-1.5 text-destructive sm:flex-none"
                      disabled={busy}
                      onClick={() => void decide(r, 'reject')}
                    >
                      <X className="h-4 w-4" /> Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-chip-500">Already decided</h3>
          <div className="grid gap-2">
            {rest.map((r) => (
              <Card key={r.id} className="opacity-80">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-chip-800">{describe(r)}</p>
                    <p className="text-xs text-chip-500">
                      {r.decidedBy?.name ?? r.decidedBy?.email ?? '—'}
                      {r.status !== 'REJECTED' && ` · ${r.printsUsed} of ${r.printsApproved} prints used`}
                    </p>
                  </div>
                  <Badge variant={r.status === 'CONSUMED' ? 'secondary' : 'default'} className={STATUS_TONE[r.status]}>
                    {r.status === 'CONSUMED' ? 'Used up' : r.status.toLowerCase()}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
