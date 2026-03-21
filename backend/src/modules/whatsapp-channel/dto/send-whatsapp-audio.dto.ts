import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;
}