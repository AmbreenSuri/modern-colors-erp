import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Scan one finished-goods QR to dispatch it. */
export class DispatchScanDto {
  @IsString()
  @MinLength(1)
  uniqueId!: string; // must be an FG- code; MC- raw units are rejected with a clear message

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  device?: string;
}

/** Dispatch all remaining units of one batch at once (full pallet). */
export class DispatchBatchDto {
  @IsString()
  @MinLength(1)
  batchId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
