import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOrchestratorSettingsDto {
  @IsOptional()
  @IsBoolean()
  automaticMode?: boolean;

  @IsOptional()
  @IsBoolean()
  assistedMode?: boolean;

  @IsOptional()
  @IsBoolean()
  enableRoleDetection?: boolean;

  @IsOptional()
  @IsBoolean()
  enableIntentClassification?: boolean;

  @IsOptional()
  @IsBoolean()
  enableToolExecution?: boolean;

  @IsOptional()
  @IsBoolean()
  requireConfirmationForCriticalActions?: boolean;

  @IsOptional()
  @IsIn(['strict', 'guarded', 'balanced'])
  autonomyLevel?: 'strict' | 'guarded' | 'balanced';

  @IsOptional()
  @IsString()
  @MaxLength(240)
  fallbackStrategy?: string;
}