import {
  IsArray,
  IsBoolean,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  identifier?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumberString()
  salesPrice?: string;

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
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
