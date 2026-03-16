import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

import { PromptType } from '../entities/prompt.entity';

export class CreatePromptDto {
  @IsString()
  name!: string;

  @IsIn(['system', 'behavior', 'sales', 'support'])
  type!: PromptType;

  @IsString()
  content!: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
