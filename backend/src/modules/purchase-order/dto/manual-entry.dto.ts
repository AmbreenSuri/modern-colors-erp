import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ManualLineItemDto {
  @IsString()
  @MinLength(1)
  materialName!: string;

  @IsOptional()
  @IsString()
  hsnCode?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;
}

// Manual entry (invariant I7) — used when AI extraction fails or the operator
// chooses to type the PO by hand. Also backs the "Enter PO manually" flow (no file).
export class ManualEntryDto {
  @IsOptional()
  @IsString()
  poNumber?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  deliveryDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualLineItemDto)
  lineItems!: ManualLineItemDto[];
}
