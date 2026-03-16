import { BaseEntity } from '../../../common/entities/base.entity';
export type MemoryType = 'short_term' | 'long_term' | 'context';
export declare class MemoryEntity extends BaseEntity {
    companyId: string;
    contactId: string;
    type: MemoryType;
    content: string;
}
