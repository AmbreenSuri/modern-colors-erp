import type { AuthUser, Department, Role } from '@/types/api'

const DEPT_LABEL: Record<Department, string> = { PU: 'PU', ENAMEL: 'Enamel', POWDER: 'Powder' }

/**
 * User-facing label for a role. Note the Phase 2 mapping: the internal `ADMIN` role is
 * the "Store" login, and the new view-only `OVERSIGHT` role is labelled "Admin".
 */
export function roleLabel(user: Pick<AuthUser, 'role' | 'department'>): string {
  switch (user.role) {
    case 'ADMIN':
      return 'Store'
    case 'OVERSIGHT':
      return 'Admin'
    case 'DISPATCH':
      return 'Dispatch'
    case 'PRODUCTION_HEAD':
      return user.department ? `${DEPT_LABEL[user.department]} Head` : 'Production Head'
    case 'SUPERVISOR':
      return 'Supervisor'
    case 'OPERATOR':
      return 'Operator'
    default:
      return user.role
  }
}

// Convenience role groups for UI gating (server-side is the real enforcement).
export const isStore = (role?: Role) => role === 'ADMIN'
export const isOversight = (role?: Role) => role === 'OVERSIGHT'
export const isProductionHead = (role?: Role) => role === 'PRODUCTION_HEAD'
