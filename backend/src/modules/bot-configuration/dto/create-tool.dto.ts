import { IsArray, IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateToolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category!: string;

  @IsBoolean()
  isEnabled!: boolean;

  @IsArray()
  @IsString({ each: true })
  intents!: string[];

  @IsBoolean()
  requiresConfirmation!: boolean;
}