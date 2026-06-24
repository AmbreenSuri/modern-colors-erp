import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLineItemDto {
  @IsString()
  @MinLength(1)
  materialName!: string;

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
  @IsString()
  batchNumber?: string;
}

export class UpdateLineItemDto extends PartialType(CreateLineItemDto) {}
