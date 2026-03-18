import { MessageType } from '../../messages/entities/message.entity';

export interface NormalizedEvolutionMessage {
  channel: 'whatsapp';
  senderId: string;
  senderName?: string;
  message: string;
  type: MessageType;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface EvolutionWebhookQueuedResponse {
  queued: true;
  conversationId: string;
  messageId: string;
}

export interface EvolutionWebhookIgnoredResponse {
  queued: false;
  reason: string;
}

export interface EvolutionWebhookProcessResponse {
  normalizedMessage: NormalizedEvolutionMessage;
  orchestration: EvolutionWebhookQueuedResponse | EvolutionWebhookIgnoredResponse;
}