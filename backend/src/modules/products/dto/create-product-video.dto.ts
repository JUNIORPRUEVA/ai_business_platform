import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductVideoDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  storageKey!: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  thumbnailStorageKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
