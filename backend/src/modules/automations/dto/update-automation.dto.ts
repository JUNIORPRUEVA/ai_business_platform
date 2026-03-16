import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateAutomationDto {
  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  status?: string;
}
