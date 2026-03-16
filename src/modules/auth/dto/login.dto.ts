import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

export class LoginDto {
  @IsUUID()
  companyId!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
