export interface OpenAiDraftRequest {
  senderName?: string;
  message: string;
  detectedIntent: string;
  systemPrompt: string;
  memoryContext: string;
}

export interface OpenAiDraftResponse {
  provider: 'openai' | 'mock';
  model: string;
  content: string;
  usedMockFallback: boolean;
  systemPrompt: string;
}