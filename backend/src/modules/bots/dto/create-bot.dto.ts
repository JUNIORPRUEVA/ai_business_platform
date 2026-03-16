import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBotDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsString()
  status?: string;
}
