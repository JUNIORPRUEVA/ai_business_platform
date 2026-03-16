import { BaseEntity } from '../../../common/entities/base.entity';
export declare class AutomationEntity extends BaseEntity {
    companyId: string;
    trigger: string;
    action: string;
    config: Record<string, unknown>;
    status: string;
}
