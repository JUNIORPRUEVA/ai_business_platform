import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AiService } from '../../ai/ai.service';
import { BotsService } from '../../bots/bots.service';
import { ChannelsService } from '../../channels/channels.service';
import { EvolutionApiService } from '../../channels/services/evolution-api.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessagesService } from '../../messages/messages.service';
import { PromptsService } from '../../prompts/prompts.service';
export interface MessageProcessingJob {
    companyId: string;
    channelId: string;
    contactPhone: string;
    conversationId: string;
    messageId: string;
}
export declare class MessageProcessingProcessor extends WorkerHost {
    private readonly aiService;
    private readonly botsService;
    private readonly channelsService;
    private readonly promptsService;
    private readonly messagesService;
    private readonly conversationsService;
    private readonly evolutionApiService;
    constructor(aiService: AiService, botsService: BotsService, channelsService: ChannelsService, promptsService: PromptsService, messagesService: MessagesService, conversationsService: ConversationsService, evolutionApiService: EvolutionApiService);
    process(job: Job<MessageProcessingJob>): Promise<{
        ok: true;
    }>;
}
