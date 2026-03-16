export type StoredMemoryScope = 'shortTerm' | 'longTerm' | 'operational';
export interface ConversationMemoryRecord {
    id: string;
    conversationId: string;
    senderId: string;
    channel: string;
    direction: 'incoming' | 'outgoing';
    content: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
}
export interface ConversationSummaryRecord {
    id: string;
    conversationId: string;
    summary: string;
    generatedFromMessages: number;
    updatedAt: string;
}
export interface OperationalStateRecord {
    id: string;
    conversationId: string;
    stage: string;
    lastIntent?: string;
    assignedTool?: string;
    needsHumanEscalation: boolean;
    updatedAt: string;
}
export interface MemoryLookupResult {
    id: string;
    scope: StoredMemoryScope;
    title: string;
    content: string;
    relevanceScore: number;
    createdAt: string;
}
export interface MemoryContextResult {
    conversationId: string;
    shortTerm: MemoryLookupResult[];
    longTerm: MemoryLookupResult[];
    operational: MemoryLookupResult[];
    summary?: ConversationSummaryRecord;
    formattedContext: string;
}
export interface BotMemoryStore {
    messageRecords: ConversationMemoryRecord[];
    conversationSummaries: ConversationSummaryRecord[];
    operationalStates: OperationalStateRecord[];
    longTermFacts: MemoryLookupResult[];
}
export declare function createDefaultBotMemoryStore(): BotMemoryStore;
