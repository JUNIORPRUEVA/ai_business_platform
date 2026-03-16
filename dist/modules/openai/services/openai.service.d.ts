import { ConfigService } from '@nestjs/config';
import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { OpenAiDraftRequest, OpenAiDraftResponse } from '../types/openai.types';
export declare class OpenAiService {
    private readonly configService;
    private readonly botConfigurationService;
    constructor(configService: ConfigService, botConfigurationService: BotConfigurationService);
    draftResponse(request: OpenAiDraftRequest): Promise<OpenAiDraftResponse>;
    buildSystemPrompt(basePrompt: string, memoryContext: string): string;
    private hasUsableCredentials;
    private buildMockDraft;
}
