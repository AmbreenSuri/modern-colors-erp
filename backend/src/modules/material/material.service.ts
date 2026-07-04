import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { MaterialStatus, Prisma, PurchaseOrder, POLineItem } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { QrService } from '../qr/qr.service';

const SEQ = 'material_unique_seq';

type PoWithLines = PurchaseOrder & { lineItems: POLineItem[] };

@Injectable()
export class MaterialService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly qr: QrService,
  ) {}

  // Global sequence backs the unique-ID generator (concurrency-safe, I8).
  async onModuleInit() {
    await this.prisma.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS ${SEQ} START 1`);
  }

  private formatId(n: number | bigint): string {
    return `MC-${String(n).padStart(6, '0')}`;
  }

  /**
   * Register one Material per physical unit for a confirmed PO (I3) — runs inside
   * the caller's transaction. Generates a QR per unit and audits each registration.
   * Returns the created materials.
   */
  async registerUnits(
    tx: Prisma.TransactionClient,
    po: PoWithLines,
    actorId: string,
  ) {
    const created: { id: string; uniqueId: string }[] = [];

    for (const line of po.lineItems) {
      for (let u = 0; u < line.quantity; u++) {
        const rows = await tx.$queryRawUnsafe<{ v: bigint }[]>(
          `SELECT nextval('${SEQ}') AS v`,
        );
        const uniqueId = this.formatId(rows[0].v);

        const material = await tx.material.create({
          data: {
            uniqueId,
            poId: po.id,
            materialName: line.materialName,
            sku: line.sku,
            hsnCode: line.hsnCode,
            supplier: po.supplier,
            batchNumber: line.batchNumber,
            unit: line.unit,
            weight: line.weight,
            status: MaterialStatus.REGISTERED,
          },
        });

        const payload = {
          uniqueId,
          materialName: material.materialName,
          sku: material.sku,
          hsnCode: material.hsnCode,
          supplier: material.supplier,
          poNumber: po.poNumber,
          batch: material.batchNumber,
          date: new Date().toISOString(),
        };
        const imageRef = await this.qr.dataUrl(payload);
        await tx.qrCode.create({
          data: {
            materialId: material.id,
            payload: payload as unknown as Prisma.InputJsonValue,
            imageRef,
          },
        });

        await this.audit.log(
          {
            entityType: 'Material',
            entityId: material.id,
            action: 'MATERIAL_REGISTERED',
            actorId,
            after: { uniqueId, materialName: material.materialName },
          },
          tx,
        );

        created.push({ id: material.id, uniqueId });
      }
    }

    return created;
  }

  async list(params: {
    status?: MaterialStatus;
    poId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
    const where: Prisma.MaterialWhereInput = {
      status: params.status,
      poId: params.poId,
      OR: params.search
        ? [
            { uniqueId: { contains: params.search, mode: 'insensitive' } },
            { materialName: { contains: params.search, mode: 'insensitive' } },
            { sku: { contains: params.search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        orderBy: { uniqueId: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findFirst({
      where: { OR: [{ id }, { uniqueId: id }] },
      include: { qrCode: true, po: { select: { poNumber: true, supplier: true } } },
    });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  /** Materials for a PO, with their QR payloads — used to build label sheets. */
  forPurchaseOrder(poId: string) {
    return this.prisma.material.findMany({
      where: { poId },
      include: { qrCode: true },
      orderBy: { uniqueId: 'asc' },
    });
  }
}
