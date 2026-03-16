import { BaseEntity } from '../../../common/entities/base.entity';
export type PromptType = 'system' | 'behavior' | 'sales' | 'support';
export declare class PromptEntity extends BaseEntity {
    companyId: string;
    name: string;
    type: PromptType;
    content: string;
    active: boolean;
}
