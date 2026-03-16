import { SendTestMessageDto } from '../dto/send-test-message.dto';
import { UpdatePromptDto } from '../dto/update-prompt.dto';
import { BotCenterOverviewResponse, BotContactContextResponse, BotConversationSummary, BotLogResponse, BotMemoryResponse, BotMessageResponse, BotPromptConfigResponse, BotStatusResponse, BotToolResponse, SendTestMessageResponse } from '../types/bot-center.types';
import { BotCenterService } from '../services/bot-center.service';
export declare class BotCenterController {
    private readonly botCenterService;
    constructor(botCenterService: BotCenterService);
    getOverview(conversationId?: string): Promise<BotCenterOverviewResponse>;
    getConversations(): BotConversationSummary[];
    getConversationMessages(conversationId: string): BotMessageResponse[];
    getConversationContext(conversationId: string): BotContactContextResponse;
    getConversationMemory(conversationId: string): Promise<BotMemoryResponse>;
    getTools(): BotToolResponse[];
    getLogs(): BotLogResponse[];
    getStatus(): BotStatusResponse;
    getPrompt(): BotPromptConfigResponse;
    updatePrompt(payload: UpdatePromptDto): Promise<BotPromptConfigResponse>;
    sendTestMessage(payload: SendTestMessageDto): Promise<SendTestMessageResponse>;
}
