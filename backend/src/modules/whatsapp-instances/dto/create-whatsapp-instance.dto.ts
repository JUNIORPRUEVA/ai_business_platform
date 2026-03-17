import { IsString, MinLength } from 'class-validator';

export class CreateWhatsappInstanceDto {
  @IsString()
  @MinLength(1)
  instanceName!: string;
}
