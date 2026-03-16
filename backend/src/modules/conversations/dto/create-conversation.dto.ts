import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsUUID()
  channelId!: string;

  @IsUUID()
  contactId!: string;

  @IsOptional()
  @IsString()
  status?: string;
}
