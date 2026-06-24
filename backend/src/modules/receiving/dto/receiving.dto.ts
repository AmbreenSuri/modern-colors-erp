import { IsNumber, IsOptional, IsString, MinLength, IsPositive } from 'class-validator';

export class ScanDto {
  @IsString()
  @MinLength(1)
  uniqueId!: string;

  @IsOptional()
  @IsString()
  device?: string;

  // Optional client timestamp (when scanned offline) — for audit context.
  @IsOptional()
  @IsString()
  clientTime?: string;
}

export class WeightDto {
  @IsNumber()
  @IsPositive()
  weight!: number;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsString()
  clientTime?: string;
}
