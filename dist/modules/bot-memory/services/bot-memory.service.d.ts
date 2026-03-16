import { OnModuleInit } from '@nestjs/common';
import { JsonFileStoreService } from '../../../common/persistence/json-file-store.service';
import { ConversationMemoryRecord, ConversationSummaryRecord, MemoryContextResult, MemoryLookupResult, OperationalStateRecord } from '../types/bot-memory.types';
export declare class BotMemoryService implements OnModuleInit {
    private readonly fileStore;
    private state;
    constructor(fileStore: JsonFileStoreService);
    onModuleInit(): Promise<void>;
    saveIncomingMessageMemory(input: {
        conversationId: string;
        senderId: string;
        channel: string;
        content: string;
        metadata?: Record<string, unknown>;
    }): Promise<ConversationMemoryRecord>;
    saveOutgoingMessageMemory(input: {
        conversationId: string;
        senderId: string;
        channel: string;
        content: string;
        metadata?: Record<string, unknown>;
    }): Promise<ConversationMemoryRecord>;
    saveConversationSummary(input: {
        conversationId: string;
        summary: string;
        generatedFromMessages: number;
    }): Promise<ConversationSummaryRecord>;
    saveOperationalState(input: {
        conversationId: string;
        stage: string;
        lastIntent?: string;
        assignedTool?: string;
        needsHumanEscalation: boolean;
    }): Promise<OperationalStateRecord>;
    getShortTermMemory(conversationId: string, limit?: number): MemoryLookupResult[];
    getLongTermMemory(conversationId: string): MemoryLookupResult[];
    getOperationalMemory(conversationId: string): OperationalStateRecord | null;
    buildMemoryContext(conversationId: string): MemoryContextResult;
    getStats(): {
        messageRecords: number;
        summaries: number;
        operationalStates: number;
        longTermFacts: number;
    };
    private persist;
}
