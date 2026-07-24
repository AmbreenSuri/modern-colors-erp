import { useAuth } from '@/lib/auth'
import { AuditExplorer } from '@/components/audit/AuditExplorer'

/**
 * The audit log screen.
 *
 * Uses the shared AuditExplorer. The Store desk (ADMIN) is scoped by the SERVER to its
 * own actions — inward, stock, issue, slips — so the actor filter is hidden (Store does
 * not audit other logins). A supervisor sees the whole trail with the same view.
 */
export function AuditPage() {
  const { user } = useAuth()
  // Only the whole-factory readers (never the Store desk) get the per-login actor filter.
  const showActorFilter = user?.role === 'OVERSIGHT' || user?.role === 'SUPERVISOR'
  return <AuditExplorer showActorFilter={showActorFilter} />
}
