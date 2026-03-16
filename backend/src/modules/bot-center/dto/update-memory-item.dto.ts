import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMemoryItemDto {
  @IsOptional()
  @IsIn(['shortTerm', 'longTerm', 'operational'])
  type?: 'shortTerm' | 'longTerm' | 'operational';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  content?: string;
}