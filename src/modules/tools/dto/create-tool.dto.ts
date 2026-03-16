import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateToolDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
