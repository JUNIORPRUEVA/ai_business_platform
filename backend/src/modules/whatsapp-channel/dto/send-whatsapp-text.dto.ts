import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendWhatsappTextDto {
  @IsString()
  @MaxLength(80)
  remoteJid!: string;

  @IsString()
  @MaxLength(8000)
  text!: string;

  @IsOptional()
  @IsString()
  quotedMessageId?: string;
}