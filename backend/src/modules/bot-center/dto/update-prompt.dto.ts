import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}