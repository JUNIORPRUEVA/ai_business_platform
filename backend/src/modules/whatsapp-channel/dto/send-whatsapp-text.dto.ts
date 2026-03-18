import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendWhatsappTextDto {
  @IsOptional()
  @IsUUID()
  channelConfigId?: string;

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