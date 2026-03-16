import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { UserRole } from '../../../common/auth/auth.types';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['admin', 'operator', 'viewer'])
  role?: UserRole;
}
