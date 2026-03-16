import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ProcessAiMessageDto {
  @IsUUID()
  channelId!: string;

  @IsUUID()
  conversationId!: string;

  @IsUUID()
  contactId!: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsString()
  message!: string;
}