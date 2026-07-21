import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** The only roles the factory Admin may mint. Privileged roles are seed-only. */
const CREATABLE_ROLES = [Role.PRODUCTION_HEAD, Role.DISPATCH] as const;

/** The company domain — composed server-side; never accepted as input. */
export const LOGIN_DOMAIN = '@moderncolours.local';

const safeSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  department: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Sensible minimum: 8+ chars with at least one letter and one digit, and not a
 *  published seed default. Exported for the UI to mirror. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return 'Password needs at least one letter and one digit.';
  if (pw === 'ChangeMe123!') return 'That is the published default password — pick a different one.';
  return null;
}

/** Local-part rules: lowercase letters/digits, then dots/underscores/hyphens. */
export function localPartProblem(local: string): string | null {
  if (!/^[a-z0-9][a-z0-9._-]{0,40}$/.test(local)) {
    return 'Login name may only use lowercase letters, digits, dots, underscores and hyphens, and must start with a letter or digit.';
  }
  return null;
}

/**
 * User management for the factory Admin — behind @AllowUserAdmin + UserAdminGuard.
 *
 * Invariants enforced HERE (not just in the DTO):
 *  - the domain suffix is composed server-side and cannot be bypassed;
 *  - only PRODUCTION_HEAD / DISPATCH can be minted — no escalation path exists;
 *  - heads require a department; Dispatch logins are department-less by force;
 *  - deactivation never deletes, is audited, and refuses Store/Admin accounts
 *    (locking yourself out would be unrecoverable);
 *  - no password (or hash) is ever logged, returned, or written to the audit trail.
 */
@Injectable()
export class UserAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      select: safeSelect,
      orderBy: [{ active: 'desc' }, { role: 'asc' }, { email: 'asc' }],
    });
  }

  async create(
    actorId: string,
    dto: { localPart: string; name: string; role: string; department?: string | null; password: string },
  ) {
    const local = dto.localPart.trim().toLowerCase();
    const localErr = localPartProblem(local);
    if (localErr) throw new BadRequestException(localErr);
    const email = `${local}${LOGIN_DOMAIN}`; // suffix is OURS — input never contains it

    if (!(CREATABLE_ROLES as readonly string[]).includes(dto.role)) {
      throw new BadRequestException('Only Production Head and Dispatch logins can be created here.');
    }
    const role = dto.role as Role;

    let department: 'PU' | 'ENAMEL' | 'POWDER' | null = null;
    if (role === Role.PRODUCTION_HEAD) {
      if (!dto.department || !['PU', 'ENAMEL', 'POWDER'].includes(dto.department)) {
        throw new BadRequestException('A production head needs a department (PU, Enamel or Powder).');
      }
      department = dto.department as 'PU' | 'ENAMEL' | 'POWDER';
    }
    // DISPATCH is never department-scoped — forced regardless of input.

    const pwErr = passwordProblem(dto.password);
    if (pwErr) throw new BadRequestException(pwErr);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException(`${email} already exists.`);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { email, name: dto.name.trim(), role, department, active: true, passwordHash },
      select: safeSelect,
    });

    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'USER_CREATED',
      actorId,
      after: { email: user.email, role: user.role, department: user.department }, // never the password
    });
    return user;
  }

  async resetPassword(actorId: string, id: string, password: string) {
    const user = await this.getManaged(id);
    const pwErr = passwordProblem(password);
    if (pwErr) throw new BadRequestException(pwErr);
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'USER_PASSWORD_RESET',
      actorId,
      after: { email: user.email }, // never the password
    });
    return { ok: true };
  }

  async deactivate(actorId: string, id: string) {
    const user = await this.getManaged(id);
    if (!user.active) throw new ConflictException(`${user.email} is already deactivated.`);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { active: false },
      select: safeSelect,
    });
    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'USER_DEACTIVATED',
      actorId,
      before: { active: true },
      after: { email: user.email, active: false },
    });
    return updated;
  }

  async reactivate(actorId: string, id: string) {
    const user = await this.getManaged(id);
    if (user.active) throw new ConflictException(`${user.email} is already active.`);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { active: true },
      select: safeSelect,
    });
    await this.audit.log({
      entityType: 'User',
      entityId: user.id,
      action: 'USER_REACTIVATED',
      actorId,
      before: { active: false },
      after: { email: user.email, active: true },
    });
    return updated;
  }

  /** Load a target and refuse to touch the accounts that keep the system reachable. */
  private async getManaged(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: safeSelect });
    if (!user) throw new NotFoundException('No such login.');
    if (user.role === Role.ADMIN || user.role === Role.OVERSIGHT) {
      throw new ConflictException(
        'Store and Admin logins are protected — deactivating or resetting them here could lock the factory out.',
      );
    }
    return user;
  }
}
