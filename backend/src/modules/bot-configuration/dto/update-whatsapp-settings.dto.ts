import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWhatsappSettingsDto {
  @IsOptional()
  @IsBoolean()
  autoApplyWebhook?: boolean;

  @IsOptional()
  @IsBoolean()
  trackConnectionEvents?: boolean;

  @IsOptional()
  @IsBoolean()
  trackQrEvents?: boolean;

  @IsOptional()
  @IsBoolean()
  trackMessageEvents?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveTextMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveAudioMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveImageMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveVideoMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  receiveDocumentMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  persistMediaMetadata?: boolean;

  @IsOptional()
  @IsIn(['ignore', 'notify', 'reject_if_supported'])
  callHandlingMode?: 'ignore' | 'notify' | 'reject_if_supported';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectedCallReply?: string;
}