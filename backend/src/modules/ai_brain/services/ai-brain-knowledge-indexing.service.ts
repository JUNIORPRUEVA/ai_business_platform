import { Injectable, Logger } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { extname } from 'node:path';

import { StorageService } from '../../storage/storage.service';
import { KnowledgeDocumentEntity } from '../entities/knowledge-document.entity';
import { KnowledgeChunkCandidate, KnowledgeIndexingJob } from '../types/knowledge-indexing.types';
import { AiBrainDocumentService } from './ai-brain-document.service';
import { AiBrainEmbeddingService } from './ai-brain-embedding.service';
import { AiBrainKnowledgeChunkService } from './ai-brain-knowledge-chunk.service';

@Injectable()
export class AiBrainKnowledgeIndexingService {
  private static readonly chunkSize = 1200;
  private static readonly chunkOverlap = 180;
  private static readonly maxDocumentChars = 120000;
  private readonly logger = new Logger(AiBrainKnowledgeIndexingService.name);

  constructor(
    private readonly aiBrainDocumentService: AiBrainDocumentService,
    private readonly aiBrainEmbeddingService: AiBrainEmbeddingService,
    private readonly aiBrainKnowledgeChunkService: AiBrainKnowledgeChunkService,
    private readonly storageService: StorageService,
  ) {}

  async indexDocument(job: KnowledgeIndexingJob): Promise<void> {
    const document = await this.aiBrainDocumentService.get(job.companyId, job.documentId);

    await this.aiBrainDocumentService.update(job.companyId, job.documentId, {
      status: 'indexing',
    });

    try {
      const source = await this.storageService.getObjectBuffer({
        companyId: job.companyId,
        key: document.storageKey,
      });
      const extractedText = await this.extractTextFromDocument({
        buffer: source.buffer,
        filename: document.name,
        contentType: document.contentType ?? source.contentType,
      });
      const normalizedText = this.normalizeExtractedText(extractedText);
      if (!normalizedText) {
        throw new Error('knowledge_document_empty_text');
      }

      const chunks = this.chunkText(normalizedText);
      const embeddings = await this.aiBrainEmbeddingService.embedTexts({
        companyId: job.companyId,
        texts: chunks.map((chunk) => chunk.content),
      });

      if (embeddings.vectors.length !== chunks.length) {
        throw new Error('knowledge_embedding_count_mismatch');
      }

      await this.aiBrainKnowledgeChunkService.replaceDocumentChunks({
        companyId: job.companyId,
        botId: document.botId,
        documentId: document.id,
        chunks: chunks.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings.vectors[index],
        })),
      });

      await this.aiBrainDocumentService.update(job.companyId, job.documentId, {
        status: 'ready',
        summary: this.buildAutomaticSummary(document, normalizedText, chunks.length),
      });

      await this.aiBrainDocumentService.patchMetadata(job.companyId, job.documentId, {
        indexing: {
          indexedAt: new Date().toISOString(),
          provider: embeddings.provider,
          model: embeddings.model,
          chunkCount: chunks.length,
          charCount: normalizedText.length,
        },
      });

      this.logger.log(
        `[AI KNOWLEDGE] document indexed companyId=${job.companyId} documentId=${job.documentId} chunks=${chunks.length}`,
      );
    } catch (error) {
      await this.aiBrainKnowledgeChunkService.removeDocumentChunks(job.companyId, job.documentId);
      await this.aiBrainDocumentService.update(job.companyId, job.documentId, {
        status: 'failed',
      });
      await this.aiBrainDocumentService.patchMetadata(job.companyId, job.documentId, {
        indexing: {
          failedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      this.logger.error(
        `[AI KNOWLEDGE] indexing failed companyId=${job.companyId} documentId=${job.documentId} reason=${error instanceof Error ? error.message : 'unknown_error'}`,
      );
    }
  }

  private async extractTextFromDocument(params: {
    buffer: Buffer;
    filename: string;
    contentType: string | null;
  }): Promise<string> {
    const normalizedContentType = (params.contentType ?? '').split(';')[0].trim().toLowerCase();
    const normalizedExtension = extname(params.filename).toLowerCase();

    if (normalizedContentType === 'application/pdf' || normalizedExtension === '.pdf') {
      const parser = new PDFParse({ data: params.buffer });
      try {
        const parsed = await parser.getText();
        return parsed.text;
      } finally {
        await parser.destroy();
      }
    }

    if (
      normalizedContentType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      normalizedExtension === '.docx'
    ) {
      const parsed = await mammoth.extractRawText({ buffer: params.buffer });
      return parsed.value;
    }

    if (
      normalizedContentType.startsWith('text/') ||
      normalizedContentType === 'application/json' ||
      normalizedContentType === 'application/xml' ||
      normalizedExtension === '.txt' ||
      normalizedExtension === '.md' ||
      normalizedExtension === '.csv' ||
      normalizedExtension === '.json' ||
      normalizedExtension === '.xml'
    ) {
      return params.buffer.toString('utf8');
    }

    throw new Error(
      `knowledge_unsupported_document_type_${normalizedContentType || normalizedExtension || 'unknown'}`,
    );
  }

  private normalizeExtractedText(text: string): string {
    const compact = text
      .replace(/\u0000/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .replace(/[ ]{2,}/g, ' ')
      .trim();

    if (!compact) {
      return '';
    }

    return compact.slice(0, AiBrainKnowledgeIndexingService.maxDocumentChars);
  }

  private chunkText(text: string): KnowledgeChunkCandidate[] {
    const chunks: KnowledgeChunkCandidate[] = [];
    let start = 0;
    let chunkIndex = 0;

    while (start < text.length) {
      const end = Math.min(start + AiBrainKnowledgeIndexingService.chunkSize, text.length);
      const content = text.slice(start, end).trim();
      if (content) {
        chunks.push({
          chunkIndex,
          content,
          tokenCount: this.approximateTokenCount(content),
          metadata: {
            startOffset: start,
            endOffset: end,
          },
        });
        chunkIndex += 1;
      }

      if (end >= text.length) {
        break;
      }

      start = Math.max(end - AiBrainKnowledgeIndexingService.chunkOverlap, start + 1);
    }

    return chunks;
  }

  private approximateTokenCount(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  private buildAutomaticSummary(
    document: KnowledgeDocumentEntity,
    normalizedText: string,
    chunkCount: number,
  ): string {
    const existing = document.summary?.trim();
    if (existing) {
      return existing;
    }

    const preview = normalizedText.replace(/\s+/g, ' ').slice(0, 260).trim();
    return preview
      ? `${document.kind} indexado con ${chunkCount} fragmentos. Vista previa: ${preview}`
      : `${document.kind} indexado con ${chunkCount} fragmentos.`;
  }
}
