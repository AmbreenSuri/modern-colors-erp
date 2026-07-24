import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { AuditService, STORE_AUDIT_SCOPE } from './audit.service';

const parseDate = (s?: string): Date | undefined => {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
};

/**
 * The audit READ surface.
 *
 * Oversight and Supervisor see the WHOLE trail; the Store desk (ADMIN) sees only its own
 * actions — inward, stock, issue, slips. That confinement is SERVER-forced: the scope is
 * decided here from the caller's role, never from a query parameter, so a Store request
 * can never widen itself into other desks' or the owner's business.
 *
 * Reads only — the append-only invariant (I4) is untouched, no stored row is modified,
 * and no password or hash is ever in an audit payload (asserted where those rows are
 * written). This is NOT a named door: it opens a READ, not a write.
 */
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERVISOR, Role.OVERSIGHT)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** The Store desk is confined to its own actions; everyone else sees everything. */
  private scopeFor(user: AuthUser): readonly string[] | undefined {
    return user.role === Role.ADMIN ? STORE_AUDIT_SCOPE : undefined;
  }

  @Get()
  query(
    @CurrentUser() user: AuthUser,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.query({
      actorId,
      action,
      entityType,
      entityId,
      from: parseDate(from),
      to: parseDate(to),
      actionScope: this.scopeFor(user),
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  /** Per-login activity counts — "analytics per login". Same scope as the list. */
  @Get('summary')
  summary(
    @CurrentUser() user: AuthUser,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.audit.summary({
      action,
      from: parseDate(from),
      to: parseDate(to),
      actionScope: this.scopeFor(user),
    });
  }

  /**
   * Legacy entity-scoped read, kept because existing screens (a unit's history) call it.
   * Confined for the Store desk exactly like the list above.
   */
  @Get('entity')
  entity(
    @CurrentUser() user: AuthUser,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.query({
      entityType,
      entityId,
      actionScope: this.scopeFor(user),
      pageSize: take ? Number(take) : 200,
    });
  }
}
