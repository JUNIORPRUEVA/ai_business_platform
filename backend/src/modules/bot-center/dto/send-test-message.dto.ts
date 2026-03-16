import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendTestMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}