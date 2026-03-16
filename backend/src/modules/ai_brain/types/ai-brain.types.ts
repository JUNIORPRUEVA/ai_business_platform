export interface AiBrainContext {
  detectedIntent: string;
  prompt: string;
  memoryContext: string;
  memoryItems: Array<{ key: string; value: string; category: string }>;
  documentSnippets: string[];
  activeTools: Array<{ id: string; name: string; type: string }>;
}

export interface ExtractedClientMemory {
  key: string;
  value: string;
  category: string;
  confidence: number;
}