import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateProductImageDto {
  @IsString()
  storageKey!: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  sortOrder?: number;
}
