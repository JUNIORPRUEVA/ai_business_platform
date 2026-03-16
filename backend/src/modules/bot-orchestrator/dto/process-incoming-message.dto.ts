import {
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ProcessIncomingMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  channel!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  senderId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  senderName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsISO8601()
  timestamp?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}