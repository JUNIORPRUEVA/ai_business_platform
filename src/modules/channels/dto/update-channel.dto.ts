import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

import { ChannelType } from '../entities/channel.entity';

export class UpdateChannelDto {
  @IsOptional()
  @IsIn(['whatsapp', 'instagram', 'facebook', 'webchat', 'telegram'])
  type?: ChannelType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
