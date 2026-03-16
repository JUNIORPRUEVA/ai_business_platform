import { UserRole } from '../../../common/auth/auth.types';
export declare class UpdateUserDto {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
}
