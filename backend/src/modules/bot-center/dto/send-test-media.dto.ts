import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SendTestMediaDto {
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @IsString()
  @IsNotEmpty()
  attachmentId!: string;

  @IsIn(['image', 'video', 'audio'])
  mediaType!: 'image' | 'video' | 'audio';

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}