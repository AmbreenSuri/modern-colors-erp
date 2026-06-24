import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCatalogueItemDto } from './dto/create-catalogue-item.dto';
import { UpdateCatalogueItemDto } from './dto/update-catalogue-item.dto';
import { CatalogueCandidate, matchMaterial, MatchResult } from './match.util';

// Header variants → canonical field. Import is column-tolerant.
const HEADER_MAP: Record<string, keyof ParsedRow> = {
  'material name': 'materialName',
  material: 'materialName',
  name: 'materialName',
  'item name': 'materialName',
  sku: 'sku',
  code: 'sku',
  'sku code': 'sku',
  'item code': 'sku',
  category: 'category',
  type: 'category',
  unit: 'unit',
  uom: 'unit',
  'standard packaging': 'standardPackaging',
  packaging: 'standardPackaging',
  pack: 'standardPackaging',
};

interface ParsedRow {
  materialName?: string;
  sku?: string;
  category?: string;
  unit?: string;
  standardPackaging?: string;
  metadata?: Record<string, unknown>;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class CatalogueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Create a single item (Admin or Operator "new SKU with confirmation") ──
  async create(dto: CreateCatalogueItemDto, actorId?: string, viaNoMatch = false) {
    const sku = dto.sku?.trim() || (await this.generateProvisionalSku());

    const existing = await this.prisma.masterCatalogueItem.findUnique({
      where: { sku },
    });
    if (existing) {
      throw new ConflictException(`SKU "${sku}" already exists in the catalogue`);
    }

    const item = await this.prisma.masterCatalogueItem.create({
      data: {
        materialName: dto.materialName.trim(),
        sku,
        category: dto.category?.trim() || null,
        unit: dto.unit?.trim() || null,
        standardPackaging: dto.standardPackaging?.trim() || null,
        metadata: viaNoMatch
          ? { createdVia: 'operator-no-match', provisional: !dto.sku }
          : Prisma.JsonNull,
      },
    });

    await this.audit.log({
      entityType: 'MasterCatalogueItem',
      entityId: item.id,
      action: viaNoMatch ? 'CATALOGUE_ITEM_ADDED_FROM_NO_MATCH' : 'CATALOGUE_ITEM_CREATED',
      actorId,
      after: { sku: item.sku, materialName: item.materialName },
    });

    return item;
  }

  async findAll(params: { search?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(500, Math.max(1, params.pageSize ?? 50));
    const where: Prisma.MasterCatalogueItemWhereInput = params.search
      ? {
          OR: [
            { materialName: { contains: params.search, mode: 'insensitive' } },
            { sku: { contains: params.search, mode: 'insensitive' } },
            { category: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await this.prisma.$transaction([
      this.prisma.masterCatalogueItem.findMany({
        where,
        orderBy: { materialName: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.masterCatalogueItem.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const item = await this.prisma.masterCatalogueItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Catalogue item not found');
    return item;
  }

  async update(id: string, dto: UpdateCatalogueItemDto, actorId?: string) {
    await this.findOne(id);
    const item = await this.prisma.masterCatalogueItem.update({
      where: { id },
      data: {
        materialName: dto.materialName?.trim(),
        sku: dto.sku?.trim(),
        category: dto.category?.trim(),
        unit: dto.unit?.trim(),
        standardPackaging: dto.standardPackaging?.trim(),
        active: dto.active,
      },
    });
    await this.audit.log({
      entityType: 'MasterCatalogueItem',
      entityId: id,
      action: 'CATALOGUE_ITEM_UPDATED',
      actorId,
      after: { sku: item.sku, materialName: item.materialName, active: item.active },
    });
    return item;
  }

  // Soft-delete (deactivate) so historical references stay intact.
  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    const item = await this.prisma.masterCatalogueItem.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.log({
      entityType: 'MasterCatalogueItem',
      entityId: id,
      action: 'CATALOGUE_ITEM_DEACTIVATED',
      actorId,
    });
    return item;
  }

  // ── Match (used by AI-extraction validation; informational only, I6) ──
  async match(query: { materialName: string; sku?: string | null }): Promise<MatchResult> {
    const items = await this.prisma.masterCatalogueItem.findMany({
      where: { active: true },
      select: { id: true, materialName: true, sku: true },
    });
    return matchMaterial(query, items as CatalogueCandidate[]);
  }

  // ── Bulk import (Admin) from Excel/CSV. Upsert by SKU. ──
  async importFile(buffer: Buffer, actorId?: string): Promise<ImportResult> {
    const rows = this.parseWorkbook(buffer);
    const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +1 header, +1 to 1-index
      if (!row.materialName) {
        result.skipped++;
        result.errors.push({ row: rowNum, message: 'Missing material name' });
        continue;
      }
      const sku = row.sku?.trim() || (await this.generateProvisionalSku());
      try {
        const existing = await this.prisma.masterCatalogueItem.findUnique({
          where: { sku },
        });
        await this.prisma.masterCatalogueItem.upsert({
          where: { sku },
          create: {
            materialName: row.materialName.trim(),
            sku,
            category: row.category?.trim() || null,
            unit: row.unit?.trim() || null,
            standardPackaging: row.standardPackaging?.trim() || null,
            metadata: row.metadata ? (row.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
            active: true,
          },
          update: {
            materialName: row.materialName.trim(),
            category: row.category?.trim() || null,
            unit: row.unit?.trim() || null,
            standardPackaging: row.standardPackaging?.trim() || null,
            active: true,
          },
        });
        if (existing) result.updated++;
        else result.created++;
      } catch (e) {
        result.skipped++;
        result.errors.push({ row: rowNum, message: (e as Error).message });
      }
    }

    await this.audit.log({
      entityType: 'MasterCatalogueItem',
      entityId: 'bulk-import',
      action: 'CATALOGUE_IMPORTED',
      actorId,
      after: { created: result.created, updated: result.updated, skipped: result.skipped },
    });

    return result;
  }

  // ── helpers ──
  private parseWorkbook(buffer: Buffer): ParsedRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    return raw.map((r) => {
      const parsed: ParsedRow = {};
      const extra: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(r)) {
        const canonical = HEADER_MAP[key.trim().toLowerCase()];
        const v = value == null ? '' : String(value).trim();
        if (canonical) {
          parsed[canonical] = v as never;
        } else if (v !== '') {
          extra[key.trim()] = v;
        }
      }
      if (Object.keys(extra).length > 0) parsed.metadata = extra;
      return parsed;
    });
  }

  private async generateProvisionalSku(): Promise<string> {
    // TMP-XXXXXX provisional code for new SKUs lacking an official code.
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `TMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const clash = await this.prisma.masterCatalogueItem.findUnique({
        where: { sku: candidate },
      });
      if (!clash) return candidate;
    }
    return `TMP-${Date.now().toString(36).toUpperCase()}`;
  }
}
