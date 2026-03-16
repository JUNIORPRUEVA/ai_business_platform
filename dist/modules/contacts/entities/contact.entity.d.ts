import { BaseEntity } from '../../../common/entities/base.entity';
export declare class ContactEntity extends BaseEntity {
    companyId: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    tags: string[];
}
