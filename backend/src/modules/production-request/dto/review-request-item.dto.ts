import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export type ReviewAction = 'APPROVE' | 'PARTIAL' | 'REJECT';

// Store's decision on ONE request line.
//  - APPROVE  → accept the full requestedKg
//  - PARTIAL  → accept a lower approvedKg (0 < approvedKg < requestedKg)
//  - REJECT   → reject with a reason (returned to the head)
export class ReviewRequestItemDto {
  @IsIn(['APPROVE', 'PARTIAL', 'REJECT'])
  action!: ReviewAction;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  approvedKg?: number; // required for PARTIAL

  @IsOptional()
  @IsString()
  reason?: string; // required for REJECT
}
