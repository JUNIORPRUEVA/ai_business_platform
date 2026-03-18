import { ConversationMemoryContentType, ConversationMemoryEntity, ConversationMemoryRole } from './entities/conversation-memory.entity';
import { ConversationSummaryEntity } from './entities/conversation-summary.entity';
import { ContactMemoryEntity } from './entities/contact-memory.entity';

export interface AppendConversationMemoryInput {
  companyId: string;
  contactId: string;
  conversationId: string;
  role: ConversationMemoryRole;
  content: string;
  contentType?: ConversationMemoryContentType;
  metadataJson?: Record<string, unknown>;
  source: string;
  messageId?: string | null;
  eventId?: string | null;
  dedupeAgainstLast?: boolean;
}

export interface UpsertContactMemoryInput {
  companyId: string;
  contactId: string;
  conversationId?: string | null;
  key: string;
  value: string;
  stateType?: string;
  metadataJson?: Record<string, unknown>;
  expiresAt?: Date | null;
}

export interface MemoryManualItem {
  id: string;
  title: string;
  content: string;
  type: 'shortTerm' | 'longTerm' | 'operational';
  updatedAt: string;
  isEditable: boolean;
}

export interface AssembledMemoryContext {
  summary: ConversationSummaryEntity | null;
  clientFacts: Array<{ key: string; value: string; category: string }>;
  operationalState: ContactMemoryEntity[];
  recentWindow: ConversationMemoryEntity[];
  contextText: string;
}