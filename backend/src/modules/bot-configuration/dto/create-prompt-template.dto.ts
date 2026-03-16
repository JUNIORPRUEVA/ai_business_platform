import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePromptTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(12000)
  content!: string;
}