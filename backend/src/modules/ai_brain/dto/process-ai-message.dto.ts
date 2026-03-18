import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ProcessAiMessageDto {
  @IsOptional()
  @IsUUID()
  channelId?: string;

  @IsUUID()
  conversationId!: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsString()
  message!: string;
}