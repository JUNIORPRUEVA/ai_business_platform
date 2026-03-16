import { BaseEntity } from '../../../common/entities/base.entity';
import { UserRole } from '../../../common/auth/auth.types';
export declare class UserEntity extends BaseEntity {
    companyId: string;
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
}
