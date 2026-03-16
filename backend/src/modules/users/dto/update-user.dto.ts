import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

import { UserRole } from '../../../common/auth/auth.types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  avatarKey?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'operator', 'viewer'])
  role?: UserRole;
}
