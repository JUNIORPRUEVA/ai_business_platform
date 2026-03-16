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

export interface ManualMemoryRecord {
  id: string;
  conversationId: string;
  scope: StoredMemoryScope;
  title: string;
  content: string;
  updatedAt: string;
}

export interface MemoryLookupResult {
  id: string;
  scope: StoredMemoryScope;
  title: string;
  content: string;
  relevanceScore: number;
  createdAt: string;
  isEditable?: boolean;
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
  manualMemoryItems: ManualMemoryRecord[];
}

export function createDefaultBotMemoryStore(): BotMemoryStore {
  const now = new Date().toISOString();

  return {
    messageRecords: [],
    conversationSummaries: [],
    operationalStates: [],
    longTermFacts: [
      {
        id: 'global-tone-policy',
        scope: 'longTerm',
        title: 'Enterprise tone policy',
        content:
          'Responses must stay concise, accurate, and aligned with approved business policy.',
        relevanceScore: 0.74,
        createdAt: now,
      },
      {
        id: 'global-product-grounding',
        scope: 'longTerm',
        title: 'Product grounding rule',
        content:
          'When answering about products or modules, use approved catalog facts and declared limitations only.',
        relevanceScore: 0.92,
        createdAt: now,
      },
    ],
    manualMemoryItems: [],
  };
}