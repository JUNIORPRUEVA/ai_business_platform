import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterCompanyDto {
  @IsString()
  companyName!: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsString()
  adminName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(8)
  adminPassword!: string;
}
