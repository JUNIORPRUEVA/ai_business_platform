import { IsBoolean, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateMemorySettingsDto {
  @IsOptional()
  @IsBoolean()
  enableShortTermMemory?: boolean;

  @IsOptional()
  @IsBoolean()
  enableLongTermMemory?: boolean;

  @IsOptional()
  @IsBoolean()
  enableOperationalMemory?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  recentMessageWindowSize?: number;

  @IsOptional()
  @IsBoolean()
  automaticSummarization?: boolean;

  @IsOptional()
  @IsString()
  memoryTtl?: string;

  @IsOptional()
  @IsBoolean()
  useRedis?: boolean;

  @IsOptional()
  @IsBoolean()
  usePostgreSql?: boolean;
}