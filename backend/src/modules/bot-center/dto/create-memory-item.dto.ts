import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateMemoryItemDto {
  @IsIn(['shortTerm', 'longTerm', 'operational'])
  type!: 'shortTerm' | 'longTerm' | 'operational';

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1200)
  content!: string;
}