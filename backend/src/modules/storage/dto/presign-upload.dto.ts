import { IsIn, IsOptional, IsString } from 'class-validator';

export type StorageFolder = 'bots' | 'contacts' | 'documents' | 'media';

export class PresignUploadDto {
  @IsIn(['bots', 'contacts', 'documents', 'media'])
  folder!: StorageFolder;

  @IsString()
  filename!: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
