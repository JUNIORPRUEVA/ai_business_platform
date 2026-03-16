import { IsOptional, IsString, IsUUID } from 'class-validator';

export class PresignBrainDocumentUploadDto {
  @IsString()
  filename!: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsUUID()
  botId?: string;
}