import { IsObject, IsOptional, IsString } from 'class-validator';

export class EvolutionInstanceWebhookDto {
  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsString()
  instance?: string;

  @IsOptional()
  @IsString()
  instanceName?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
