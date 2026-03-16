import { IsIn, IsOptional, IsString } from 'class-validator';

import { MessageType } from '../entities/message.entity';

export class CreateMessageDto {
  @IsString()
  content!: string;

  @IsOptional()
  @IsIn(['text', 'image', 'audio', 'video', 'document'])
  type?: MessageType;
}
