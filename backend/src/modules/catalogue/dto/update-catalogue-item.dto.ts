import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateCatalogueItemDto } from './create-catalogue-item.dto';

export class UpdateCatalogueItemDto extends PartialType(CreateCatalogueItemDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
