import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

import { PromptType } from '../entities/prompt.entity';

export class UpdatePromptDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['system', 'behavior', 'sales', 'support'])
  type?: PromptType;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
