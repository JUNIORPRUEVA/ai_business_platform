import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePromptTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  content?: string;
}