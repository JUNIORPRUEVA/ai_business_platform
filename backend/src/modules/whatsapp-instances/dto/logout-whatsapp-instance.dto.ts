import { IsString, MinLength } from 'class-validator';

export class LogoutWhatsappInstanceDto {
  @IsString()
  @MinLength(1)
  instanceName!: string;
}
