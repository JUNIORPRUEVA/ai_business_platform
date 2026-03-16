import { ConfigService } from '@nestjs/config';
export declare class AiService {
    private readonly configService;
    constructor(configService: ConfigService);
    draftReply(params: {
        model: string;
        temperature: number;
        systemPrompt: string;
        userMessage: string;
        history?: Array<{
            role: 'user' | 'assistant';
            content: string;
        }>;
    }): Promise<{
        content: string;
        provider: 'openai' | 'mock';
    }>;
}
