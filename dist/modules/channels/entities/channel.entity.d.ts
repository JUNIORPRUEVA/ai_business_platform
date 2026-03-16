import { BaseEntity } from '../../../common/entities/base.entity';
export type ChannelType = 'whatsapp' | 'instagram' | 'facebook' | 'webchat' | 'telegram';
export declare class ChannelEntity extends BaseEntity {
    companyId: string;
    type: ChannelType;
    name: string;
    status: string;
    config: Record<string, unknown>;
}
