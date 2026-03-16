import { IsIn, IsString, IsUUID } from 'class-validator';

import { MemoryType } from '../entities/memory.entity';

export class CreateMemoryDto {
  @IsUUID()
  contactId!: string;

  @IsIn(['short_term', 'long_term', 'context'])
  type!: MemoryType;

  @IsString()
  content!: string;
}
