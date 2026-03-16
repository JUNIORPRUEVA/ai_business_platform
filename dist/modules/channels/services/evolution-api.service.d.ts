import { ChannelEntity } from '../entities/channel.entity';
export declare class EvolutionApiService {
    private readonly logger;
    sendTextMessage(params: {
        channel: ChannelEntity;
        to: string;
        text: string;
    }): Promise<{
        sent: boolean;
        provider: 'evolution' | 'noop';
    }>;
}
