import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateEvolutionSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  baseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  instanceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  webhookSecret?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  connectedNumber?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}