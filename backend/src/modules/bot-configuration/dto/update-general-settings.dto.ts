import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  botName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  defaultLanguage?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  environmentLabel?: string;
}