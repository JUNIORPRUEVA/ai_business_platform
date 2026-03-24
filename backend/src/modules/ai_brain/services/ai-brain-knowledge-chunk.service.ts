import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import {
  KnowledgeChunkCandidate,
  RetrievedKnowledgeChunk,
} from '../types/knowledge-indexing.types';

@Injectable()
export class AiBrainKnowledgeChunkService {
  private readonly logger = new Logger(AiBrainKnowledgeChunkService.name);
  private availabilityCache: { checkedAt: number; available: boolean } | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async replaceDocumentChunks(params: {
    companyId: string;
    botId?: string | null;
    documentId: string;
    chunks: Array<KnowledgeChunkCandidate & { embedding: number[] }>;
  }): Promise<void> {
    if (!(await this.isVectorStoreAvailable())) {
      throw new Error('knowledge_vector_store_unavailable');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `DELETE FROM knowledge_document_chunks WHERE company_id = $1 AND document_id = $2`,
        [params.companyId, params.documentId],
      );

      for (const chunk of params.chunks) {
        await manager.query(
          `
            INSERT INTO knowledge_document_chunks (
              company_id,
              bot_id,
              document_id,
              chunk_index,
              content,
              token_count,
              status,
              metadata,
              embedding
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'ready', $7::jsonb, $8::vector)
          `,
          [
            params.companyId,
            params.botId ?? null,
            params.documentId,
            chunk.chunkIndex,
            chunk.content,
            chunk.tokenCount,
            JSON.stringify(chunk.metadata ?? {}),
            this.toVectorLiteral(chunk.embedding),
          ],
        );
      }
    });
  }

  async removeDocumentChunks(companyId: string, documentId: string): Promise<void> {
    if (!(await this.isVectorStoreAvailable())) {
      return;
    }

    await this.dataSource.query(
      `DELETE FROM knowledge_document_chunks WHERE company_id = $1 AND document_id = $2`,
      [companyId, documentId],
    );
  }

  async searchRelevantChunks(params: {
    companyId: string;
    botId: string;
    embedding: number[];
    limit?: number;
  }): Promise<RetrievedKnowledgeChunk[]> {
    const limit = Math.min(Math.max(params.limit ?? 6, 1), 12);

    if (!(await this.isVectorStoreAvailable())) {
      return [];
    }

    try {
      const rows = await this.dataSource.query(
        `
          SELECT
            chunk.document_id AS "documentId",
            document.name AS "documentName",
            chunk.chunk_index AS "chunkIndex",
            chunk.content AS "content",
            chunk.metadata AS "metadata",
            1 - (chunk.embedding <=> $3::vector) AS "similarity"
          FROM knowledge_document_chunks chunk
          INNER JOIN knowledge_documents document
            ON document.id = chunk.document_id
           AND document.company_id = chunk.company_id
          WHERE chunk.company_id = $1
            AND (chunk.bot_id IS NULL OR chunk.bot_id = $2)
            AND document.status = 'ready'
            AND chunk.status = 'ready'
          ORDER BY chunk.embedding <=> $3::vector ASC
          LIMIT $4
        `,
        [params.companyId, params.botId, this.toVectorLiteral(params.embedding), limit],
      );

      return rows.map((row: Record<string, unknown>) => ({
        documentId: String(row['documentId']),
        documentName: String(row['documentName']),
        chunkIndex: Number(row['chunkIndex']),
        content: String(row['content']),
        similarity: Number(row['similarity']),
        metadata:
          row['metadata'] && typeof row['metadata'] === 'object'
            ? (row['metadata'] as Record<string, unknown>)
            : {},
      }));
    } catch (error) {
      this.logger.warn(
        `[AI KNOWLEDGE] similarity search unavailable reason=${error instanceof Error ? error.message : 'unknown_error'}`,
      );
      return [];
    }
  }

  private async isVectorStoreAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.availabilityCache && now - this.availabilityCache.checkedAt < 60_000) {
      return this.availabilityCache.available;
    }

    try {
      const [row] = await this.dataSource.query(
        `
          SELECT
            EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS "hasVector",
            to_regclass('public.knowledge_document_chunks') IS NOT NULL AS "hasChunksTable"
        `,
      );

      const available =
        Boolean(row?.hasVector ?? row?.hasvector) &&
        Boolean(row?.hasChunksTable ?? row?.haschunkstable);

      this.availabilityCache = {
        checkedAt: now,
        available,
      };

      if (!available) {
        this.logger.warn(
          '[AI KNOWLEDGE] vector store unavailable; pgvector extension or knowledge_document_chunks table is missing',
        );
      }

      return available;
    } catch (error) {
      this.availabilityCache = {
        checkedAt: now,
        available: false,
      };
      this.logger.warn(
        `[AI KNOWLEDGE] vector store availability check failed reason=${error instanceof Error ? error.message : 'unknown_error'}`,
      );
      return false;
    }
  }

  private toVectorLiteral(values: number[]): string {
    return `[${values.map((value) => (Number.isFinite(value) ? value : 0)).join(',')}]`;
  }
}
