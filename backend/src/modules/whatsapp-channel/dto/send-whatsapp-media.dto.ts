import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendWhatsappMediaDto {
  @IsString()
  @MaxLength(80)
  remoteJid!: string;

  @IsIn(['image', 'video', 'document'])
  mediaType!: 'image' | 'video' | 'document';

  @IsOptional()
  @IsString()
  attachmentId?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  quotedMessageId?: string;
}