import { UserRole } from '../../../common/auth/auth.types';
export declare class CreateUserDto {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
}
