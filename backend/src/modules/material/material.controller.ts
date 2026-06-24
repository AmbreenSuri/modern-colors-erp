import {
  Controller,
  Get,
  Param,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { MaterialStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { MaterialService } from './material.service';
import { QrService, QrPayload } from '../qr/qr.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaterialController {
  constructor(
    private readonly materials: MaterialService,
    private readonly qr: QrService,
  ) {}

  @Get('materials')
  list(
    @Query('status') status?: MaterialStatus,
    @Query('poId') poId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.materials.list({
      status,
      poId,
      search,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('materials/:id')
  findOne(@Param('id') id: string) {
    return this.materials.findOne(id);
  }

  // Printable QR label sheet (PDF) for every unit of a PO.
  @Get('purchase-orders/:poId/labels.pdf')
  async labels(@Param('poId') poId: string): Promise<StreamableFile> {
    const materials = await this.materials.forPurchaseOrder(poId);
    const items = materials.map((m) => ({
      payload: (m.qrCode?.payload as unknown as QrPayload) ?? {
        uniqueId: m.uniqueId,
        materialName: m.materialName,
        sku: m.sku,
        supplier: m.supplier,
        poNumber: null,
        batch: m.batchNumber,
        date: m.createdAt.toISOString(),
      },
    }));
    const pdf = await this.qr.buildLabelSheet(items);
    // Sanitize poId (URL-supplied) before it reaches the header — prevents
    // Content-Disposition / header injection.
    const safePoId = poId.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="labels-${safePoId}.pdf"`,
    });
  }
}
