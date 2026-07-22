import { useCallback, useEffect, useState } from 'react'
import { Lock, Send, Clock, CheckCircle2 } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/useToast'
import { useAutoRefresh } from '@/lib/refresh'
import type { ReprintScope, ReprintStatusView } from '@/types/api'

/**
 * The lock, as the factory floor sees it.
 *
 * The first print of any label set shows nothing at all — this renders its children
 * and gets out of the way, which is the whole point: the release act keeps working
 * exactly as it did. Only once those labels have been printed does the lock appear,
 * with the one thing the operator can actually do about it.
 *
 * This is a courtesy, NOT the enforcement. The server refuses a second print whether
 * or not this component is on screen.
 */
export function ReprintGate({
  scope,
  targetId,
  children,
}: {
  scope: ReprintScope
  targetId: string
  children: React.ReactNode
}) {
  const [state, setState] = useState<ReprintStatusView | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    () =>
      api
        .get<ReprintStatusView>(`/label-reprints/status?scope=${scope}&targetId=${encodeURIComponent(targetId)}`)
        .then(setState)
        .catch(() => setState(null)),
    [scope, targetId],
  )
  useEffect(() => void load(), [load])
  // An approval granted on the owner's phone should appear here without a reload.
  useAutoRefresh(load, { intervalMs: 20_000 })

  const submit = async () => {
    setBusy(true)
    try {
      await api.post('/label-reprints/request', { scope, targetId, reason: reason.trim() })
      toast({ title: 'Reprint requested', description: 'The factory Admin has been asked to approve it.' })
      setReason('')
      await load()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not request a reprint',
        description: err instanceof ApiError ? err.message : 'Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  // Until we know, assume open: a status hiccup must never block a first print.
  if (!state || state.mayPrint) {
    return (
      <div className="space-y-2">
        {state?.request?.status === 'APPROVED' && (
          <p className="flex items-center gap-1.5 text-xs text-healthy">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Reprint approved — {state.request.printsApproved - state.request.printsUsed} of{' '}
            {state.request.printsApproved} print{state.request.printsApproved === 1 ? '' : 's'} left.
          </p>
        )}
        {children}
      </div>
    )
  }

  const pending = state.request?.status === 'PENDING'

  return (
    <Card edge={pending ? 'info' : 'warning'}>
      <CardContent className="space-y-3 p-3.5">
        <div className="flex items-start gap-2">
          {pending ? (
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          ) : (
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          )}
          <div className="min-w-0 text-sm">
            <p className="font-medium text-chip-900">
              {pending ? 'Waiting for approval' : 'These labels have already been printed'}
            </p>
            <p className="mt-0.5 text-chip-600">
              {pending
                ? `Requested by ${state.request?.requestedBy?.name ?? 'someone'} — the factory Admin decides how many reprints to allow.`
                : 'Printing them again needs the factory Admin’s approval, so duplicate stickers cannot reach the floor by accident.'}
            </p>
            {pending && state.request?.reason && (
              <p className="mt-1 text-xs italic text-chip-500">“{state.request.reason}”</p>
            )}
          </div>
        </div>

        {!pending && (
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${targetId}`}>Why do these need printing again?</Label>
            <textarea
              id={`reason-${targetId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. the printer jammed and half the roll came out blank"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button className="h-11 w-full gap-1.5 sm:w-auto" disabled={busy || reason.trim().length < 3} onClick={submit}>
              <Send className="h-4 w-4" /> Request approval
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
