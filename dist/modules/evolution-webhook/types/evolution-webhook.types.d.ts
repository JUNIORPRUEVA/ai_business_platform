export interface NormalizedEvolutionMessage {
    channel: 'whatsapp';
    senderId: string;
    senderName?: string;
    message: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
}
export interface EvolutionWebhookQueuedResponse {
    queued: true;
    conversationId: string;
    messageId: string;
}
export interface EvolutionWebhookProcessResponse {
    normalizedMessage: NormalizedEvolutionMessage;
    orchestration: EvolutionWebhookQueuedResponse;
}
