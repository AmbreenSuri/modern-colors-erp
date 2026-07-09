import { ForbiddenException } from '@nestjs/common';
import { Department, Role } from '@prisma/client';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Server-side department isolation (Phase 2). These are the single source of truth
 * used by every department-scoped endpoint so a PRODUCTION_HEAD can NEVER see or touch
 * another department's data at the API layer (not just hidden in the UI).
 *
 * Roles that legitimately see ALL departments (the Store and the view-only Admin).
 * Everything else is either scoped to its own department (PRODUCTION_HEAD) or denied.
 */
const CROSS_DEPARTMENT_ROLES: readonly Role[] = [Role.ADMIN, Role.OVERSIGHT];

/** True for roles that may read across every department (Store / Admin). */
export function isCrossDepartment(user: AuthUser): boolean {
  return CROSS_DEPARTMENT_ROLES.includes(user.role);
}

/**
 * Prisma `where` fragment for LIST queries of department-scoped resources.
 *  - Store / Admin  → `{}`  (all departments)
 *  - PRODUCTION_HEAD → `{ department: <their own> }`
 *  - anyone else    → denied (defense in depth; @Roles should already gate the route)
 */
export function departmentFilter(user: AuthUser): { department?: Department } {
  if (isCrossDepartment(user)) return {};
  if (user.role === Role.PRODUCTION_HEAD) {
    if (!user.department) {
      throw new ForbiddenException('Your account has no department assigned.');
    }
    return { department: user.department };
  }
  throw new ForbiddenException('This resource is not available for your role.');
}

/**
 * Guard access to a SINGLE resource by its department. Store/Admin pass; a
 * PRODUCTION_HEAD passes only for their own department; everyone else is denied.
 * Throws 403 otherwise — use before returning/acting on a specific record.
 */
export function assertDepartmentAccess(user: AuthUser, resourceDepartment: Department): void {
  if (isCrossDepartment(user)) return;
  if (user.role === Role.PRODUCTION_HEAD && user.department === resourceDepartment) return;
  throw new ForbiddenException("You cannot access another department's data.");
}

/**
 * The department a NEW department-scoped record must belong to — always forced to the
 * acting production head's own department (a client-supplied department is ignored, so
 * a head cannot raise a request "for" another department).
 */
export function ownDepartment(user: AuthUser): Department {
  if (user.role === Role.PRODUCTION_HEAD && user.department) return user.department;
  throw new ForbiddenException('Only a production head can create department-scoped records.');
}
