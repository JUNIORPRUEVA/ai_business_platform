import { IsIn, IsOptional, IsString } from 'class-validator';

import { MemoryType } from '../entities/memory.entity';

export class UpdateMemoryDto {
  @IsOptional()
  @IsIn(['short_term', 'long_term', 'context'])
  type?: MemoryType;

  @IsOptional()
  @IsString()
  content?: string;
}
