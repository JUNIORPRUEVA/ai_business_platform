import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateIntegrationsSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  metaCloudApiToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  metaPhoneNumberId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  instagramToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  webhookUrl?: string;
}