import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class SaveWhatsappChannelConfigDto {
  @IsOptional()
  @IsUrl({ require_tld: false })
  evolutionServerUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  evolutionApiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  instanceName?: string;

  @IsOptional()
  @IsBoolean()
  webhookEnabled?: boolean;

  @IsOptional()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;

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

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}