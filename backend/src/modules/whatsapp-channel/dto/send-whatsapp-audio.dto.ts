import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendWhatsappAudioDto {
  @IsString()
  @MaxLength(80)
  remoteJid!: string;

  @IsOptional()
  @IsString()
  attachmentId?: string;

  @IsOptional()
  @IsString()
  audioUrl?: string;

  @IsOptional()
  @IsString()
  quotedMessageId?: string;
}