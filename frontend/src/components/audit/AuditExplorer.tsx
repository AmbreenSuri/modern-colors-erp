import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollText, ChevronLeft, ChevronRight, Filter, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import type { AuditEntry, AuditSummaryRow, ManagedUser } from '@/types/api'

interface Paginated {
  data: AuditEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * The audit read view, shared by Oversight (whole factory, with the actor filter) and
 * the Store desk (server-scoped to its own actions, no actor filter).
 *
 * The scope is enforced by the SERVER from the caller's role — this component only
 * decides which controls to show. The trail only grows, so it is never loaded whole:
 * every fetch is one page. Reads only; nothing here mutates the append-only log.
 */
export function AuditExplorer({ showActorFilter = false }: { showActorFilter?: boolean }) {
  const [action, setAction] = useState('')
  const [actorId, setActorId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [res, setRes] = useState<Paginated | null>(null)
  const [summary, setSummary] = useState<AuditSummaryRow[] | null>(null)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [openRow, setOpenRow] = useState<string | null>(null)

  // Oversight can filter by login; the dropdown reuses the user-admin list it already
  // reaches. Store never sees this control.
  useEffect(() => {
    if (showActorFilter) api.get<ManagedUser[]>('/admin/users').then(setUsers).catch(() => setUsers([]))
  }, [showActorFilter])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    if (action.trim()) p.set('action', action.trim())
    if (actorId) p.set('actorId', actorId)
    if (from) p.set('from', new Date(from).toISOString())
    if (to) p.set('to', new Date(to).toISOString())
    return p
  }, [action, actorId, from, to])

  const load = useCallback(() => {
    const p = new URLSearchParams(qs)
    p.set('page', String(page))
    api.get<Paginated>(`/audit?${p.toString()}`).then(setRes).catch(() => setRes(null))
    // Summary ignores pagination; it is the per-login rollup for the current filters.
    api.get<AuditSummaryRow[]>(`/audit/summary?${qs.toString()}`).then(setSummary).catch(() => setSummary(null))
  }, [qs, page])
  useEffect(() => void load(), [load])

  // Any filter change resets to page 1.
  useEffect(() => setPage(1), [action, actorId, from, to])

  return (
    <div className="space-y-4">
      {/* Per-login summary — "analytics per login" */}
      {summary && summary.length > 0 && (
        <Card>
          <CardContent className="p-3.5">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-chip-500">
              <Users className="h-3.5 w-3.5" /> Activity per login {from || to ? '(filtered window)' : ''}
            </h3>
            <div className="flex flex-wrap gap-2">
              {summary.slice(0, 12).map((s) => (
                <button
                  key={s.actorId ?? 'system'}
                  type="button"
                  disabled={!showActorFilter || !s.actorId}
                  onClick={() => showActorFilter && s.actorId && setActorId(actorId === s.actorId ? '' : s.actorId)}
                  className={`tactile rounded-md border px-2.5 py-1.5 text-left text-xs ${
                    actorId && actorId === s.actorId ? 'border-primary bg-primary/5' : 'border-input'
                  } ${showActorFilter && s.actorId ? 'hover:bg-accent' : 'cursor-default'}`}
                >
                  <span className="block font-medium text-chip-900">
                    {s.actor?.name ?? s.actor?.email ?? 'system / seed'}
                  </span>
                  <span className="text-chip-500 tabular-nums">{s.count} actions</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-chip-500">
            <Filter className="h-3 w-3" /> Action
          </span>
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="e.g. STOCK_DEDUCT" className="h-10 w-48" />
        </label>
        {showActorFilter && (
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wide text-chip-500">Login</span>
            <select
              value={actorId}
              onChange={(e) => setActorId(e.target.value)}
              className="h-10 w-48 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">Everyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {u.email}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-chip-500">From</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-wide text-chip-500">To</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
        </label>
        {(action || actorId || from || to) && (
          <Button
            variant="ghost"
            className="h-10"
            onClick={() => {
              setAction('')
              setActorId('')
              setFrom('')
              setTo('')
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {!res ? (
        <p className="text-sm text-chip-500">Loading…</p>
      ) : res.data.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing matches" description="No audit entries for these filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-chip-500">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Login</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">On</th>
                </tr>
              </thead>
              <tbody>
                {res.data.map((r) => {
                  const payload = (r.afterJson ?? r.beforeJson) as Record<string, unknown> | null
                  // Surface a scanned unit id when the payload carries one — receiving
                  // scans, stock moves, dispatch, packing all put uniqueId here.
                  const unit =
                    payload && typeof payload === 'object' && 'uniqueId' in payload
                      ? String((payload as { uniqueId: unknown }).uniqueId)
                      : null
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-b last:border-0 hover:bg-accent/40"
                      onClick={() => setOpenRow(openRow === r.id ? null : r.id)}
                    >
                      <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-chip-600">
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-2 py-1.5">{r.actor?.name ?? r.actor?.email ?? 'system'}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {r.action}
                        </Badge>
                        {openRow === r.id && payload && (
                          <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px] text-chip-700">
                            {JSON.stringify(payload, null, 1)}
                          </pre>
                        )}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs text-chip-600">
                        {unit ?? <span className="text-chip-400">{r.entityType}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm text-chip-600">
            <span>
              {res.total} entries · page {res.page} of {res.totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-9 w-9" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                disabled={page >= res.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
