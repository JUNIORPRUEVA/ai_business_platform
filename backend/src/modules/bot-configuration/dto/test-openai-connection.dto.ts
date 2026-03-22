import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestOpenAiConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(240)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;
}