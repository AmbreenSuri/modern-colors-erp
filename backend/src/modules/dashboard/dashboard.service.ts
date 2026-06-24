import { Injectable } from '@nestjs/common';
import { MaterialStatus, POStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface SearchFilters {
  status?: MaterialStatus;
  supplier?: string;
  poNumber?: string;
  q?: string; // material name / SKU / unique ID
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // Live metrics for the dashboard (PRD §6.7).
  async summary() {
    const start = startOfToday();
    const [
      todaysPOs,
      totalMaterials,
      todaysMaterials,
      pendingScanning,
      pendingWeighing,
      readyForProduction,
      bySupplier,
      byMaterial,
      poByStatus,
    ] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where: { createdAt: { gte: start } } }),
      this.prisma.material.count(),
      this.prisma.material.count({ where: { createdAt: { gte: start } } }),
      this.prisma.material.count({
        where: { status: { in: [MaterialStatus.REGISTERED, MaterialStatus.ARRIVED] } },
      }),
      this.prisma.material.count({ where: { status: MaterialStatus.SCANNED } }),
      this.prisma.material.count({ where: { status: MaterialStatus.READY_FOR_PRODUCTION } }),
      this.prisma.material.groupBy({ by: ['supplier'], _count: { _all: true }, orderBy: { supplier: 'asc' } }),
      this.prisma.material.groupBy({ by: ['materialName'], _count: { _all: true }, orderBy: { materialName: 'asc' } }),
      this.prisma.purchaseOrder.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);

    const topN = (rows: Array<Record<string, unknown>>, key: string, n = 10) =>
      rows
        .map((r) => ({
          label: (r[key] as string) ?? 'Unspecified',
          count: (r._count as { _all?: number } | undefined)?._all ?? 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);

    return {
      todaysPurchaseOrders: todaysPOs,
      materialsReceived: { total: totalMaterials, today: todaysMaterials },
      pendingScanning,
      pendingWeighing,
      readyForProduction,
      supplierStats: topN(bySupplier as Array<Record<string, unknown>>, 'supplier'),
      materialStats: topN(byMaterial as Array<Record<string, unknown>>, 'materialName'),
      poStatusBreakdown: poByStatus.reduce<Record<string, number>>((acc, r) => {
        acc[r.status as POStatus] = (r._count as { _all?: number } | undefined)?._all ?? 0;
        return acc;
      }, {}),
    };
  }

  // Unified search across registered material units (PRD §6.7 filters).
  async search(f: SearchFilters) {
    const page = Math.max(1, f.page ?? 1);
    const pageSize = Math.min(200, Math.max(1, f.pageSize ?? 50));

    const createdAt: Prisma.DateTimeFilter = {};
    if (f.startDate) createdAt.gte = new Date(f.startDate);
    if (f.endDate) createdAt.lte = new Date(f.endDate);

    const where: Prisma.MaterialWhereInput = {
      status: f.status,
      supplier: f.supplier ? { contains: f.supplier, mode: 'insensitive' } : undefined,
      po: f.poNumber ? { poNumber: { contains: f.poNumber, mode: 'insensitive' } } : undefined,
      createdAt: f.startDate || f.endDate ? createdAt : undefined,
      OR: f.q
        ? [
            { uniqueId: { contains: f.q, mode: 'insensitive' } },
            { materialName: { contains: f.q, mode: 'insensitive' } },
            { sku: { contains: f.q, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.material.findMany({
        where,
        include: { po: { select: { poNumber: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.material.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }
}
