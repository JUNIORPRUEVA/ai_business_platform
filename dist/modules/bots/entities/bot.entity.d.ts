import { BaseEntity } from '../../../common/entities/base.entity';
export declare class BotEntity extends BaseEntity {
    companyId: string;
    name: string;
    model: string;
    temperature: number;
    status: string;
}
