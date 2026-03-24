export interface KnowledgeIndexingJob {
  companyId: string;
  documentId: string;
}

export interface KnowledgeChunkCandidate {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

export interface RetrievedKnowledgeChunk {
  documentId: string;
  documentName: string;
  chunkIndex: number;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}
