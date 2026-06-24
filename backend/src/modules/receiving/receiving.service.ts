import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MaterialStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Receiving (Step 6 of the workflow): scan a unit on arrival, then enter its
 * single confirmed weight. Both operations are designed to be idempotent so the
 * frontend's offline queue can safely re-send on reconnect without losing or
 * duplicating data (invariant I9).
 */
@Injectable()
export class ReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Scan on receiving → SCANNED. Re-scanning an already-scanned unit is a no-op. */
  async scan(uniqueId: string, actorId: string, device?: string) {
    const m = await this.prisma.material.findUnique({ where: { uniqueId } });
    if (!m) throw new NotFoundException(`No unit with ID ${uniqueId}`);

    const scannable =
      m.status === MaterialStatus.REGISTERED || m.status === MaterialStatus.ARRIVED;
    if (!scannable) {
      // Already scanned/weighed/ready — idempotent success (offline re-send).
      return { material: m, changed: false, alreadyScanned: true };
    }

    const now = new Date();
    const material = await this.prisma.material.update({
      where: { id: m.id },
      data: { status: MaterialStatus.SCANNED, scannedAt: now, arrivedAt: m.arrivedAt ?? now },
    });
    await this.audit.log({
      entityType: 'Material',
      entityId: m.id,
      action: 'SCANNED',
      actorId,
      device,
      before: { status: m.status },
      after: { status: MaterialStatus.SCANNED },
    });
    return { material, changed: true, alreadyScanned: false };
  }

  /**
   * Enter the confirmed receiving weight (single value, not gross/net/tare).
   * Auto-advances to READY_FOR_PRODUCTION. A weight on an already-weighed unit is
   * recorded as an audited CORRECTION, never a silent overwrite (invariant I4).
   */
  async weigh(uniqueId: string, weight: number, actorId: string, device?: string) {
    if (!(weight > 0)) throw new BadRequestException('Weight must be greater than 0.');
    const m = await this.prisma.material.findUnique({ where: { uniqueId } });
    if (!m) throw new NotFoundException(`No unit with ID ${uniqueId}`);

    if (m.status === MaterialStatus.REGISTERED || m.status === MaterialStatus.ARRIVED) {
      throw new BadRequestException('Scan the unit before entering its weight.');
    }

    const isCorrection =
      m.status === MaterialStatus.WEIGHED ||
      m.status === MaterialStatus.READY_FOR_PRODUCTION;

    // Idempotent: identical weight re-sent (offline retry) — no new correction.
    if (isCorrection && m.receivedWeight === weight) {
      return { material: m, changed: false, corrected: false };
    }

    const material = await this.prisma.material.update({
      where: { id: m.id },
      data: {
        receivedWeight: weight,
        weighedById: actorId,
        weighedAt: new Date(),
        status: MaterialStatus.READY_FOR_PRODUCTION,
      },
    });
    await this.audit.log({
      entityType: 'Material',
      entityId: m.id,
      action: isCorrection ? 'WEIGHT_CORRECTED' : 'WEIGHT_ENTERED',
      actorId,
      device,
      before: isCorrection ? { receivedWeight: m.receivedWeight } : { status: m.status },
      after: { receivedWeight: weight, status: MaterialStatus.READY_FOR_PRODUCTION },
    });
    return { material, changed: true, corrected: isCorrection };
  }
}
