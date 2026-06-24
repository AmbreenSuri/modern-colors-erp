import { IsString, MinLength } from 'class-validator';

export class SetApiKeyDto {
  @IsString()
  @MinLength(10)
  apiKey!: string;
}
