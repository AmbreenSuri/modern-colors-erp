import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * A production head starts a new batch. The department is ALWAYS forced to the head's
 * own (server-side) — a client-supplied department is ignored, so a head can never
 * create a batch for another department.
 */
export class CreateBatchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  batchNumber!: string; // e.g. "B-001" — unique within the head's department

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
