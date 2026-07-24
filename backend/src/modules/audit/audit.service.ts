import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntryInput {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  device?: string | null;
  /** When set, this entry records a correction of an existing audit row (I4). */
  correctionOfId?: string | null;
}

/**
 * Append-only audit writer (invariant I4). There is intentionally NO update or
 * delete method — corrections are recorded as new rows referencing the original.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write one audit entry. Accepts an optional transaction client so callers can
   * log atomically with their write.
   */
  async log(
    input: AuditEntryInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        actorId: input.actorId ?? null,
        beforeJson: input.before ?? Prisma.JsonNull,
        afterJson: input.after ?? Prisma.JsonNull,
        device: input.device ?? null,
        correctionOfId: input.correctionOfId ?? null,
      },
    });
  }

  /** Read entries, newest first. Optionally filter by entity. (legacy, still used) */
  async list(params: { entityType?: string; entityId?: string; take?: number }) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: params.entityType,
        entityId: params.entityId,
      },
      include: { actor: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 200,
    });
  }

  /**
   * The audit READ engine — filterable and server-side paginated.
   *
   * The trail only ever grows, so it is never loaded whole: page/pageSize bound every
   * response. `actions` (when present) is an allow-list the CALLER cannot widen — it is
   * how the Store desk is confined to its own actions while Oversight sees everything.
   */
  async query(params: {
    actorId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    /** Server-forced allow-list of action prefixes; a scoped caller cannot escape it. */
    actionScope?: readonly string[];
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
    const where = this.buildWhere(params);
    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * Per-login activity summary — "analytics per login": how many actions each account
   * performed in the window, most active first. Honours the same scope and filters.
   */
  async summary(params: {
    from?: Date;
    to?: Date;
    action?: string;
    actionScope?: readonly string[];
  }) {
    const where = this.buildWhere(params);
    const grouped = await this.prisma.auditLog.groupBy({
      by: ['actorId'],
      where,
      _count: { _all: true },
      orderBy: { _count: { actorId: 'desc' } },
    });
    // Attach the login identity to each count. Actorless rows (system/seed) group under
    // a null bucket, surfaced as "system".
    const ids = grouped.map((g) => g.actorId).filter((x): x is string => !!x);
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, email: true, role: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return grouped.map((g) => ({
      actor: g.actorId ? (byId.get(g.actorId) ?? null) : null,
      actorId: g.actorId,
      count: g._count._all,
    }));
  }

  private buildWhere(params: {
    actorId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    actionScope?: readonly string[];
  }): Prisma.AuditLogWhereInput {
    const and: Prisma.AuditLogWhereInput[] = [];
    if (params.actorId) and.push({ actorId: params.actorId });
    if (params.entityType) and.push({ entityType: params.entityType });
    if (params.entityId) and.push({ entityId: params.entityId });
    if (params.action) and.push({ action: params.action });
    if (params.from || params.to) {
      and.push({ createdAt: { gte: params.from, lte: params.to } });
    }
    // The scope is a set of PREFIXES (STOCK_ matches STOCK_ADD/DEDUCT/DISCARD). Applied
    // as an OR of startsWith, ANDed with everything else — so a scoped caller asking for
    // an out-of-scope action gets nothing, never someone else's trail.
    if (params.actionScope && params.actionScope.length) {
      and.push({ OR: params.actionScope.map((p) => ({ action: { startsWith: p } })) });
    }
    return and.length ? { AND: and } : {};
  }
}

/**
 * The Store desk's audit scope — inward, stock, issue and slips, and nothing else.
 * Prefixes, so new actions in these families are covered without editing this list.
 * NOT included, by design: USER_*, SETTING, STORE_INWARD_ACCESS_CHANGED, LABEL_REPRINT_*
 * decisions, FG_*, PACKING/CARTON — those are other desks' or the owner's business.
 */
export const STORE_AUDIT_SCOPE = [
  'PO_',
  'AI_EXTRACT',
  'OPERATOR_VERIFIED',
  'MATERIAL',
  'RECEIVED',
  'PACK_WEIGHT',
  'RECEIVING_SLIP_',
  'STOCK_',
  'FIFO_OVERRIDE',
  'PRODUCTION_REQUEST',
  'REQUEST_ITEM_',
  'BATCH_POST_CONFIRM',
] as const;
