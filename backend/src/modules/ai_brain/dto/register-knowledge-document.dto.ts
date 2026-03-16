import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class RegisterKnowledgeDocumentDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  storageKey!: string;

  @IsOptional()
  @IsUUID()
  botId?: string;

  @IsOptional()
  @IsString()
  contentType?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}