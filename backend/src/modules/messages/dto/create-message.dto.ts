import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { MessageType } from '../entities/message.entity';

export class CreateMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsIn(['text', 'image', 'audio', 'video', 'document'])
  type?: MessageType;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}
