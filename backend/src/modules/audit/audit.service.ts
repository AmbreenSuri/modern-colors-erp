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

  /** Read entries, newest first. Optionally filter by entity. */
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
}
