export interface OpenAiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAiDraftRequest {
  senderName?: string;
  message?: string;
  detectedIntent: string;
  systemPrompt?: string;
  memoryContext?: string;
  messages?: OpenAiChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface OpenAiDraftResponse {
  provider: 'openai' | 'mock';
  model: string;
  content: string;
  usedMockFallback: boolean;
  systemPrompt: string;
}