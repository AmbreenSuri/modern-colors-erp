import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { Department, StockTxnType } from '@prisma/client';

/**
 * One stock movement on a scanned physical unit (Store only). Every scan offers all
 * three types (Override 3). Server rules (see StockService):
 *  - ADD / DEDUCT  → department is REQUIRED (material to/from a department)
 *  - DISCARD       → department is ignored (wasted stock, not tied to a department)
 *  - DEDUCT / DISCARD → never take the unit below 0 (over-deduction blocked)
 *  - requestItemId → optional; links a DEDUCT to an approved request LINE and must
 *                    match that line's material (hard QR-verify) and department.
 */
export class CreateStockTransactionDto {
  @IsString()
  uniqueId!: string; // the scanned unit ("MC-000296")

  @IsEnum(StockTxnType)
  type!: StockTxnType;

  @IsNumber()
  @IsPositive()
  quantityKg!: number; // always > 0

  @IsOptional()
  @IsEnum(Department)
  department?: Department; // required for ADD/DEDUCT, ignored for DISCARD

  @IsOptional()
  @IsString()
  requestItemId?: string; // link to an approved request line (DEDUCT only)

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  device?: string;
}
