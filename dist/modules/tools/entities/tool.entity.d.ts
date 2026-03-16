import { BaseEntity } from '../../../common/entities/base.entity';
export declare class ToolEntity extends BaseEntity {
    companyId: string;
    name: string;
    type: string;
    config: Record<string, unknown>;
    active: boolean;
}
