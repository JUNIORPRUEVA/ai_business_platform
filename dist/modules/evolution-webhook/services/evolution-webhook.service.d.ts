import { Queue } from 'bullmq';
import { EvolutionMessageWebhookDto } from '../dto/evolution-message-webhook.dto';
import { EvolutionWebhookProcessResponse } from '../types/evolution-webhook.types';
import { ChannelsService } from '../../channels/channels.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessagesService } from '../../messages/messages.service';
import { MessageProcessingJob } from '../../workers/processors/message-processing.processor';
export declare class EvolutionWebhookService {
    private readonly channelsService;
    private readonly contactsService;
    private readonly conversationsService;
    private readonly messagesService;
    private readonly messageProcessingQueue;
    constructor(channelsService: ChannelsService, contactsService: ContactsService, conversationsService: ConversationsService, messagesService: MessagesService, messageProcessingQueue: Queue<MessageProcessingJob>);
    processIncomingMessage(params: {
        channelId: string;
        webhookToken?: string;
        payload: EvolutionMessageWebhookDto;
    }): Promise<EvolutionWebhookProcessResponse>;
    private normalizePayload;
    private extractMessageText;
}
