import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Department, Prisma, RequestStatus, StockTxnType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateStockTransactionDto } from './dto/create-stock-transaction.dto';

const unitSelect = {
  id: true,
  uniqueId: true,
  materialName: true,
  sku: true,
  status: true,
  receivedWeight: true,
  balanceKg: true,
  po: { select: { poNumber: true, supplier: true } },
} satisfies Prisma.MaterialSelect;

/** Same material? Compare by SKU when both have one, else by normalized name. */
function sameMaterial(
  a: { sku: string | null; materialName: string },
  b: { sku: string | null; materialName: string },
): boolean {
  if (a.sku && b.sku) return a.sku.trim().toLowerCase() === b.sku.trim().toLowerCase();
  return a.materialName.trim().toLowerCase() === b.materialName.trim().toLowerCase();
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Look up a scanned unit for the movement panel. 409 if it has no confirmed weight. */
  async getUnit(uniqueId: string) {
    const unit = await this.prisma.material.findUnique({
      where: { uniqueId },
      select: unitSelect,
    });
    if (!unit) throw new NotFoundException(`No unit with ID ${uniqueId}`);
    if (unit.balanceKg == null) {
      throw new ConflictException(
        `Unit ${uniqueId} has no confirmed weight yet — weigh it before any stock movement.`,
      );
    }
    return unit;
  }

  /** The append-only movement history for one unit (newest first). */
  async unitTransactions(uniqueId: string) {
    const unit = await this.prisma.material.findUnique({
      where: { uniqueId },
      select: { id: true, uniqueId: true, materialName: true, sku: true, balanceKg: true },
    });
    if (!unit) throw new NotFoundException(`No unit with ID ${uniqueId}`);
    const transactions = await this.prisma.stockTransaction.findMany({
      where: { materialId: unit.id },
      include: {
        actor: { select: { id: true, name: true } },
        requestItem: { select: { id: true, requestId: true, materialName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { unit, transactions };
  }

  /**
   * Record ONE Add / Deduct / Discard on a scanned unit. The ledger row and the
   * unit's balanceKg are written in the SAME DB transaction so they never drift.
   * DEDUCT/DISCARD can never take the unit below zero (over-deduction blocked).
   */
  async createTransaction(user: AuthUser, dto: CreateStockTransactionDto) {
    if (!(dto.quantityKg > 0)) {
      throw new BadRequestException('Quantity (KG) must be greater than 0.');
    }

    const isDiscard = dto.type === StockTxnType.DISCARD;
    // ADD / DEDUCT go to/from a department; DISCARD is dept-less.
    const department = isDiscard ? null : dto.department ?? null;
    if (!isDiscard && !department) {
      throw new BadRequestException('Select a department for an Add or Deduct movement.');
    }
    if (dto.requestItemId && dto.type !== StockTxnType.DEDUCT) {
      throw new BadRequestException('A request line can only be linked to a Deduct.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock the unit row so concurrent scans of the same unit can't both pass the
      // balance check and drive it negative.
      const locked = await tx.$queryRaw<
        { id: string; balanceKg: number | null; materialName: string; sku: string | null }[]
      >`SELECT "id", "balanceKg", "materialName", "sku" FROM "Material" WHERE "uniqueId" = ${dto.uniqueId} FOR UPDATE`;
      const row = locked[0];
      if (!row) throw new NotFoundException(`No unit with ID ${dto.uniqueId}`);
      if (row.balanceKg == null) {
        throw new ConflictException(
          `Unit ${dto.uniqueId} has no confirmed weight yet — weigh it before any stock movement.`,
        );
      }

      const before = row.balanceKg;
      let requestItem: {
        id: string;
        requestId: string;
        status: RequestStatus;
        approvedKg: number | null;
        issuedKg: number;
        department: Department | null;
        materialName: string;
        sku: string | null;
      } | null = null;

      // Request-driven deduction: validate the line, its department, material match,
      // and the approved cap BEFORE moving any stock.
      if (dto.requestItemId) {
        // Lock the request line FOR UPDATE so two concurrent deducts against the SAME
        // line (via different physical units) can't both read a stale issuedKg and
        // jointly exceed approvedKg. The lock is held until this transaction commits.
        const lockedItem = await tx.$queryRaw<{ issuedKg: number; approvedKg: number | null }[]>`
          SELECT "issuedKg", "approvedKg" FROM "ProductionRequestItem" WHERE "id" = ${dto.requestItemId} FOR UPDATE`;
        if (!lockedItem[0]) throw new NotFoundException('Request line not found.');

        const item = await tx.productionRequestItem.findUnique({
          where: { id: dto.requestItemId },
          select: {
            id: true,
            status: true,
            approvedKg: true,
            issuedKg: true,
            materialName: true,
            sku: true,
            request: { select: { id: true, department: true } },
          },
        });
        if (!item) throw new NotFoundException('Request line not found.');
        if (item.status !== RequestStatus.APPROVED && item.status !== RequestStatus.PARTIAL) {
          throw new BadRequestException('Only an approved or partially-approved line can be issued.');
        }
        // Hard QR-verify: the scanned unit must be the requested material.
        if (!sameMaterial(row, item)) {
          throw new BadRequestException(
            `Scanned unit is ${row.materialName}${row.sku ? ` (${row.sku})` : ''}, but this line requested ${item.materialName}${item.sku ? ` (${item.sku})` : ''}.`,
          );
        }
        // The chosen department must match the request's department.
        if (department !== item.request.department) {
          throw new BadRequestException(
            `This line belongs to ${item.request.department}; deduct against that department.`,
          );
        }
        const approved = item.approvedKg ?? 0;
        if (item.issuedKg + dto.quantityKg > approved + 1e-9) {
          const remaining = Math.max(0, approved - item.issuedKg);
          throw new BadRequestException(
            `Cannot issue ${dto.quantityKg} kg — only ${remaining} kg of the approved ${approved} kg remain on this line.`,
          );
        }
        requestItem = {
          id: item.id,
          requestId: item.request.id,
          status: item.status,
          approvedKg: item.approvedKg,
          issuedKg: item.issuedKg,
          department: item.request.department,
          materialName: item.materialName,
          sku: item.sku,
        };
      }

      // Compute the new balance and block anything that would go negative.
      let balanceAfter: number;
      if (dto.type === StockTxnType.ADD) {
        balanceAfter = before + dto.quantityKg;
      } else {
        // DEDUCT or DISCARD — cannot exceed what's on the unit.
        if (dto.quantityKg > before + 1e-9) {
          const verb = isDiscard ? 'discard' : 'deduct';
          throw new BadRequestException(
            `Cannot ${verb} ${dto.quantityKg} kg — only ${before} kg remain on ${dto.uniqueId}.`,
          );
        }
        balanceAfter = before - dto.quantityKg;
      }
      // Guard against float drift landing just under zero.
      balanceAfter = Math.max(0, Number(balanceAfter.toFixed(6)));

      const txn = await tx.stockTransaction.create({
        data: {
          materialId: row.id,
          type: dto.type,
          quantityKg: dto.quantityKg,
          department,
          requestItemId: requestItem?.id ?? null,
          actorId: user.id,
          balanceAfter,
          note: dto.note?.trim() || null,
        },
      });

      await tx.material.update({
        where: { id: row.id },
        data: { balanceKg: balanceAfter },
      });

      // Advance the request line's issued total (and fulfilment) when this was a
      // request-driven deduction.
      if (requestItem) {
        const newIssued = Number((requestItem.issuedKg + dto.quantityKg).toFixed(6));
        const approved = requestItem.approvedKg ?? 0;
        const fulfilled = newIssued + 1e-9 >= approved;
        await tx.productionRequestItem.update({
          where: { id: requestItem.id },
          data: {
            issuedKg: newIssued,
            fulfilledAt: fulfilled ? new Date() : undefined,
          },
        });
      }

      await this.audit.log(
        {
          entityType: 'StockTransaction',
          entityId: txn.id,
          action: `STOCK_${dto.type}`,
          actorId: user.id,
          device: dto.device ?? null,
          before: { uniqueId: dto.uniqueId, balanceKg: before },
          after: {
            uniqueId: dto.uniqueId,
            type: dto.type,
            quantityKg: dto.quantityKg,
            department,
            balanceKg: balanceAfter,
            requestItemId: requestItem?.id ?? null,
            requestId: requestItem?.requestId ?? null,
          },
        },
        tx,
      );

      const unit = await tx.material.findUnique({ where: { id: row.id }, select: unitSelect });
      return { transaction: txn, unit };
    });
  }
}
