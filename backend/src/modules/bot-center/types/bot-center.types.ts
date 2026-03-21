export type BotConversationStage =
  | 'onboarding'
  | 'qualified'
  | 'negotiation'
  | 'follow_up'
  | 'escalated';

export type BotMessageAuthor = 'contact' | 'bot' | 'operator' | 'system';

export type BotMessageState = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export type BotMemoryType = 'shortTerm' | 'longTerm' | 'operational';

export type BotLogSeverity = 'info' | 'warning' | 'critical';

export type ServiceHealthState = 'healthy' | 'degraded' | 'offline';

export interface BotConversationSummary {
  id: string;
  contactName: string;
  phone: string;
  lastMessagePreview: string;
  unreadCount: number;
  stage: BotConversationStage;
  timestamp: string;
}

export interface BotMessageResponse {
  id: string;
  conversationId: string;
  author: BotMessageAuthor;
  body: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'system' | 'unknown';
  caption: string | null;
  mimeType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  fileName: string | null;
  duration: number | null;
  timestamp: string;
  state: BotMessageState;
}

export interface BotProductKnowledgeResponse {
  name: string;
  summary: string;
  keyCapabilities: string[];
  qualificationSignals: string[];
  cautionPoints: string[];
}

export interface BotContactContextResponse {
  customerName: string;
  phone: string;
  role: string;
  businessType: string;
  city: string;
  tags: string[];
  productKnowledge: BotProductKnowledgeResponse[];
}

export interface BotMemoryItemResponse {
  id: string;
  title: string;
  content: string;
  type: BotMemoryType;
  updatedAt: string;
  isEditable?: boolean;
}

export interface BotMemoryResponse {
  shortTerm: BotMemoryItemResponse[];
  longTerm: BotMemoryItemResponse[];
  operational: BotMemoryItemResponse[];
}

export interface BotToolResponse {
  id: string;
  name: string;
  description: string;
  category: string;
  active: boolean;
}

export interface BotDeliveryDiagnosticsResponse {
  conversationId: string;
  companyId: string;
  remoteJidOriginal: string;
  stored: {
    canonicalRemoteJid: string | null;
    canonicalNumber: string | null;
    originalRemoteJid: string | null;
    rawRemoteJid: string | null;
    sendTarget: string | null;
    lastInboundJidType: string | null;
    replyTargetUnresolved: boolean;
    channelConfigId: string | null;
  };
  resolution: {
    canReply: boolean;
    reason: string;
    canonicalJid: string | null;
    canonicalNumber: string | null;
    source: string | null;
  };
  lastInboundMessage: {
    id: string | null;
    createdAt: string | null;
    evolutionMessageId: string | null;
    messageType: string | null;
  };
  lastInboundPayloadSnapshot: Record<string, unknown> | null;
}

export interface BotLogResponse {
  id: string;
  timestamp: string;
  eventType: string;
  summary: string;
  severity: BotLogSeverity;
  conversationId?: string;
}

export interface BotStatusCardResponse {
  label: string;
  value: string;
  description: string;
  state: ServiceHealthState;
}

export interface BotStatusResponse {
  connectedChannel: BotStatusCardResponse;
  aiStatus: BotStatusCardResponse;
  backendStatus: BotStatusCardResponse;
  databaseStatus: BotStatusCardResponse;
  memoryStatus: BotStatusCardResponse;
}

export interface BotPromptConfigResponse {
  id: string;
  title: string;
  description: string;
  content: string;
  updatedAt: string;
}

export interface BotConversationDetailResponse {
  conversation: BotConversationSummary;
  messages: BotMessageResponse[];
  context: BotContactContextResponse;
  memory: BotMemoryResponse;
}

export interface BotCenterOverviewResponse {
  conversations: BotConversationSummary[];
  tools: BotToolResponse[];
  logs: BotLogResponse[];
  status: BotStatusResponse;
  prompt: BotPromptConfigResponse;
  selectedConversation?: BotConversationDetailResponse;
}

export interface SendTestMessageResponse {
  success: boolean;
  conversationId: string;
  message: string;
  dispatchedAt: string;
  status: 'accepted';
  outboundMessage?: BotMessageResponse;
}

export interface SendMediaMessageResponse extends SendTestMessageResponse {}

export interface BotCenterRealtimeEventResponse {
  event: 'message.upsert' | 'message.status';
  conversation: BotConversationSummary;
  message: BotMessageResponse;
}

export interface BotCenterConversationRecord {
  summary: BotConversationSummary;
  messages: BotMessageResponse[];
  context: BotContactContextResponse;
  memory: BotMemoryResponse;
}

export interface BotCenterSeedData {
  conversations: BotCenterConversationRecord[];
  tools: BotToolResponse[];
  logs: BotLogResponse[];
  status: BotStatusResponse;
  prompt: BotPromptConfigResponse;
}