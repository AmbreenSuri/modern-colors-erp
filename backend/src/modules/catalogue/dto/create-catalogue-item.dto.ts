import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCatalogueItemDto {
  @IsString()
  @MinLength(1)
  materialName!: string;

  // Optional: operators adding a brand-new SKU on the fly may not have an
  // official code yet — one is auto-generated (provisional) if omitted.
  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  standardPackaging?: string;
}
