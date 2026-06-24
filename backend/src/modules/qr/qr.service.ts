import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface QrPayload {
  uniqueId: string;
  materialName: string;
  sku: string | null;
  supplier: string | null;
  poNumber: string | null;
  batch: string | null;
  date: string; // ISO
}

export interface LabelInput {
  payload: QrPayload;
}

/**
 * QR generation (1 per physical unit) + printable label sheets (PDF).
 * The QR encodes the full payload as JSON; the scan flow reads `uniqueId`.
 */
@Injectable()
export class QrService {
  dataUrl(payload: QrPayload): Promise<string> {
    return QRCode.toDataURL(JSON.stringify(payload), { width: 320, margin: 1 });
  }

  pngBuffer(payload: QrPayload): Promise<Buffer> {
    return QRCode.toBuffer(JSON.stringify(payload), { type: 'png', width: 320, margin: 1 });
  }

  /** A4 grid of labels (2 columns × 5 rows = 10 per page). */
  async buildLabelSheet(items: LabelInput[]): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 595.28; // A4 portrait (pt)
    const PAGE_H = 841.89;
    const COLS = 2;
    const ROWS = 5;
    const perPage = COLS * ROWS;
    const margin = 28;
    const cellW = (PAGE_W - margin * 2) / COLS;
    const cellH = (PAGE_H - margin * 2) / ROWS;

    for (let i = 0; i < items.length; i++) {
      if (i % perPage === 0) doc.addPage([PAGE_W, PAGE_H]);
      const page = doc.getPages()[doc.getPageCount() - 1];
      const idx = i % perPage;
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = margin + col * cellW;
      const yTop = PAGE_H - margin - row * cellH;

      const { payload } = items[i];
      const qrPng = await this.pngBuffer(payload);
      const img = await doc.embedPng(qrPng);
      const qrSize = Math.min(cellH - 24, 110);
      page.drawImage(img, {
        x: x + 8,
        y: yTop - qrSize - 8,
        width: qrSize,
        height: qrSize,
      });

      const textX = x + qrSize + 16;
      let textY = yTop - 18;
      const line = (label: string, value: string, bold = false) => {
        page.drawText(`${label}${value}`, {
          x: textX,
          y: textY,
          size: bold ? 10 : 8,
          font: bold ? fontBold : font,
          color: rgb(0.1, 0.1, 0.12),
        });
        textY -= bold ? 14 : 11;
      };
      line('', payload.uniqueId, true);
      line('', this.truncate(payload.materialName, 28));
      if (payload.sku) line('SKU: ', this.truncate(payload.sku, 22));
      if (payload.supplier) line('Sup: ', this.truncate(payload.supplier, 22));
      if (payload.poNumber) line('PO: ', this.truncate(payload.poNumber, 22));
      if (payload.batch) line('Batch: ', this.truncate(payload.batch, 20));
      line('', new Date(payload.date).toISOString().slice(0, 10));

      // cell border
      page.drawRectangle({
        x,
        y: yTop - cellH + 4,
        width: cellW - 6,
        height: cellH - 8,
        borderColor: rgb(0.8, 0.8, 0.82),
        borderWidth: 0.5,
      });
    }

    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  private truncate(s: string, n: number): string {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
}
