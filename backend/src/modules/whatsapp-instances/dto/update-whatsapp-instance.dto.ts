import { IsString, MinLength } from 'class-validator';

export class UpdateWhatsappInstanceDto {
  @IsString()
  @MinLength(1)
  newInstanceName!: string;
}