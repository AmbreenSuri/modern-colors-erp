import { BadRequestException, ConflictException } from '@nestjs/common';
import { isFinishedGoodId, FG_PREFIX } from './finished-goods.service';
import { isBatchLocked } from '../batch/batch.service';
import { BatchStatus } from '@prisma/client';

describe('Phase 3 — finished-goods identity rules', () => {
  describe('isFinishedGoodId (FG- vs raw MC-)', () => {
    it('accepts FG- codes (any case, padded)', () => {
      expect(isFinishedGoodId('FG-000001')).toBe(true);
      expect(isFinishedGoodId('fg-000123')).toBe(true);
      expect(isFinishedGoodId('  FG-000002  ')).toBe(true);
    });
    it('rejects raw-material MC- codes — they must never dispatch', () => {
      expect(isFinishedGoodId('MC-000001')).toBe(false);
      expect(isFinishedGoodId('mc-000999')).toBe(false);
    });
    it('rejects junk / empty', () => {
      expect(isFinishedGoodId('')).toBe(false);
      expect(isFinishedGoodId('12345')).toBe(false);
      expect(isFinishedGoodId('BATCH-1')).toBe(false);
    });
    it('uses the FG- prefix constant', () => {
      expect(FG_PREFIX).toBe('FG-');
    });
  });

  describe('isBatchLocked (top-up warning, never a block)', () => {
    it('OPEN and OUTPUT_RECORDED are not locked', () => {
      expect(isBatchLocked(BatchStatus.OPEN)).toBe(false);
      expect(isBatchLocked(BatchStatus.OUTPUT_RECORDED)).toBe(false);
    });
    it('CONFIRMED and CLOSED are locked (→ warn on further requests)', () => {
      expect(isBatchLocked(BatchStatus.CONFIRMED)).toBe(true);
      expect(isBatchLocked(BatchStatus.CLOSED)).toBe(true);
    });
  });
});

/**
 * The FG generation gate — the single most important rule of Phase 3: QR codes can
 * never be minted from an unconfirmed output, and never twice for the same output.
 * We fake Prisma so the branching is exercised without a database.
 */
describe('Phase 3 — FG generation gate', () => {
  const { FinishedGoodsService } = require('./finished-goods.service');

  function make(output: any) {
    const prisma: any = {
      productionOutput: { findUnique: async () => output },
      $executeRawUnsafe: async () => undefined,
    };
    const svc = new FinishedGoodsService(
      prisma,
      { log: async () => undefined } as never,
      { dataUrl: async () => 'data:image/png;base64,x' } as never,
      // Minting never consults the lock — asserted structurally in label-reprint.spec.ts.
      { assertMayPrint: async () => undefined, consumePrint: async () => ({ via: 'FIRST_PRINT' }) } as never,
    );
    return svc;
  }
  const store = { id: 'u1', role: 'ADMIN', name: 'Store', email: 'a@b', department: null } as any;

  it('BLOCKS generation when the output is not confirmed', async () => {
    const svc = make({
      id: 'o1', confirmed: false, fgGeneratedAt: null, packageCount: 5,
      batch: { department: 'PU', batchNumber: 'B-1' },
    });
    await expect(svc.generate(store, 'o1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('BLOCKS a second generation for the same output (no duplicate stickers)', async () => {
    const svc = make({
      id: 'o1', confirmed: true, fgGeneratedAt: new Date(), packageCount: 5,
      batch: { department: 'PU', batchNumber: 'B-1' },
    });
    await expect(svc.generate(store, 'o1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('BLOCKS generation when packageCount is 0', async () => {
    const svc = make({
      id: 'o1', confirmed: true, fgGeneratedAt: null, packageCount: 0,
      batch: { department: 'PU', batchNumber: 'B-1' },
    });
    await expect(svc.generate(store, 'o1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
