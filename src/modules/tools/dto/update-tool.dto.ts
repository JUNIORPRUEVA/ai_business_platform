import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateToolDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
