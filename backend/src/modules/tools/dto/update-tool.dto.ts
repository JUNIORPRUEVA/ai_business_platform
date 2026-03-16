import { IsBoolean, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateToolDto {
  @IsOptional()
  @IsUUID()
  botId?: string;

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
