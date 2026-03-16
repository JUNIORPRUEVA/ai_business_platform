import { ChannelType } from '../entities/channel.entity';
export declare class UpdateChannelDto {
    type?: ChannelType;
    name?: string;
    status?: string;
    config?: Record<string, unknown>;
}
