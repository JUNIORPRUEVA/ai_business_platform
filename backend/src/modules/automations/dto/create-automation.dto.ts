import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateAutomationDto {
  @IsString()
  trigger!: string;

  @IsString()
  action!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  status?: string;
}
