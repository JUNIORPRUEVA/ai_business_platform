import {
  ArrayMaxSize,
  IsInt,
  IsArray,
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ImportProductRowDto {
  @IsString()
  identifier!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsNumberString()
  salesPrice!: string;

  @IsOptional()
  @IsNumberString()
  offerPrice?: string;

  @IsOptional()
  @IsNumberString()
  discountPercent?: string;

  @IsOptional()
  @IsBoolean()
  negotiationAllowed?: boolean;

  @IsOptional()
  @IsNumberString()
  negotiationMarginPercent?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  benefits?: string;

  @IsOptional()
  @IsString()
  availabilityText?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;
}

export class ImportProductsDto {
  @IsOptional()
  @IsString()
  csvText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportProductRowDto)
  rows?: ImportProductRowDto[];

  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}
