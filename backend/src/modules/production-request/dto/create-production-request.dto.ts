import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

// One material line within a request.
export class RequestLineItemDto {
  @IsString()
  @MinLength(1)
  materialName!: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  catalogueItemId?: string;

  @IsNumber()
  @IsPositive()
  requestedKg!: number;

  // Phase 3 — the batch this LINE is for (per line, not per request: a head may order
  // for several batches at once). Must be an existing batch in the head's OWN
  // department; the server re-checks ownership. Optional for backwards compatibility.
  @IsOptional()
  @IsString()
  batchId?: string;
}

// A production head raises ONE request holding many material lines (a batch's worth).
// The department is NEVER accepted from the client — it is forced to the head's own.
export class CreateProductionRequestDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RequestLineItemDto)
  items!: RequestLineItemDto[];
}
