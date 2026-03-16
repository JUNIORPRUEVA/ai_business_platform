import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSecuritySettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  internalApiToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  webhookSigningSecret?: string;

  @IsOptional()
  @IsBoolean()
  encryptSecrets?: boolean;

  @IsOptional()
  @IsBoolean()
  auditLog?: boolean;
}