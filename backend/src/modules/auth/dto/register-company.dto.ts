import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterCompanyDto {
  @IsString()
  companyName!: string;

  @IsOptional()
  @IsString()
  plan?: string;

  @IsString()
  adminName!: string;

  // Preferred keys
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  // Aliases to support simpler clients
  @IsOptional()
  @IsEmail()
  email?: string;

  // Preferred keys
  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  // Aliases to support simpler clients
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
