import { BotMemoryService } from '../../bot-memory/services/bot-memory.service';
import { BotDetectedIntent, BotDetectedRole, BotRuntimeConfiguration, LoadedMemoryBundle } from '../types/bot-orchestrator.types';
export declare class MemoryLoaderService {
    private readonly botMemoryService;
    constructor(botMemoryService: BotMemoryService);
    loadAll(params: {
        conversationId: string;
        senderId: string;
        detectedIntent: BotDetectedIntent;
        detectedRole: BotDetectedRole;
        configuration: BotRuntimeConfiguration;
    }): LoadedMemoryBundle;
    private mapMemoryItems;
    private withFallback;
    private loadShortTermMemory;
    private loadLongTermMemory;
    private loadOperationalMemory;
}
