import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class ConfigureWhatsappWebhookDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookByEvents?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookBase64?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  webhookEvents?: string[];
}