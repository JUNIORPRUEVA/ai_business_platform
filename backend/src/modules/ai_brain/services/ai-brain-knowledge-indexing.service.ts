import { Injectable, Logger } from '@nestjs/common';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { extname } from 'node:path';

import { OpenAiService } from '../../openai/services/openai.service';
import { StorageService } from '../../storage/storage.service';
import { KnowledgeDocumentEntity } from '../entities/knowledge-document.entity';
import { KnowledgeChunkCandidate, KnowledgeIndexingJob } from '../types/knowledge-indexing.types';
import { AiBrainDocumentService } from './ai-brain-document.service';
import { AiBrainEmbeddingService } from './ai-brain-embedding.service';
import { AiBrainKnowledgeChunkService } from './ai-brain-knowledge-chunk.service';

interface ExtractedDocumentPage {
  pageNumber: number;
  text: string;
}

interface ExtractedDocumentContent {
  text: string;
  pages: ExtractedDocumentPage[];
}

@Injectable()
export class AiBrainKnowledgeIndexingService {
  private static readonly chunkSize = 1100;
  private static readonly chunkOverlap = 220;
  private static readonly minChunkSize = 280;
  private static readonly maxDocumentChars = 120000;
  private static readonly minUsefulPdfChars = 400;
  private static readonly maxOcrPages = 20;
  private readonly logger = new Logger(AiBrainKnowledgeIndexingService.name);

  constructor(
    private readonly aiBrainDocumentService: AiBrainDocumentService,
    private readonly aiBrainEmbeddingService: AiBrainEmbeddingService,
    private readonly aiBrainKnowledgeChunkService: AiBrainKnowledgeChunkService,
    private readonly openAiService: OpenAiService,
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
      const extracted = await this.extractTextFromDocument({
        companyId: job.companyId,
        buffer: source.buffer,
        filename: document.name,
        contentType: document.contentType ?? source.contentType,
      });

      const normalizedPages = extracted.pages
        .map((page) => ({
          pageNumber: page.pageNumber,
          text: this.normalizeExtractedText(page.text),
        }))
        .filter((page) => page.text.length > 0);

      const normalizedText =
        normalizedPages.length > 0
          ? normalizedPages.map((page) => `Pagina ${page.pageNumber}\n${page.text}`).join('\n\n')
          : this.normalizeExtractedText(extracted.text);

      if (!normalizedText) {
        throw new Error('knowledge_document_empty_text');
      }

      const chunks =
        normalizedPages.length > 0
          ? this.chunkDocumentPages(normalizedPages)
          : this.chunkText(normalizedText);
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
          pageCount: normalizedPages.length || null,
        },
      });

      this.logger.log(
        `[AI KNOWLEDGE] document indexed companyId=${job.companyId} documentId=${job.documentId} pages=${normalizedPages.length || 1} chars=${normalizedText.length} chunks=${chunks.length}`,
      );
    } catch (error) {
      try {
        await this.aiBrainKnowledgeChunkService.removeDocumentChunks(job.companyId, job.documentId);
      } catch (cleanupError) {
        this.logger.warn(
          `[AI KNOWLEDGE] cleanup failed companyId=${job.companyId} documentId=${job.documentId} reason=${cleanupError instanceof Error ? cleanupError.message : 'unknown_error'}`,
        );
      }
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
    companyId: string;
    buffer: Buffer;
    filename: string;
    contentType: string | null;
  }): Promise<ExtractedDocumentContent> {
    const normalizedContentType = (params.contentType ?? '').split(';')[0].trim().toLowerCase();
    const normalizedExtension = extname(params.filename).toLowerCase();

    if (normalizedContentType === 'application/pdf' || normalizedExtension === '.pdf') {
      const parser = new PDFParse({ data: params.buffer });
      try {
        const parsed = await parser.getText();
        const extracted: ExtractedDocumentContent = {
          text: parsed.text,
          pages: Array.isArray(parsed.pages)
            ? parsed.pages.map((page) => ({
                pageNumber: page.num,
                text: page.text,
              }))
            : [],
        };

        if (!this.shouldUsePdfOcrFallback(extracted)) {
          return extracted;
        }

        const screenshots = await parser.getScreenshot({
          desiredWidth: 1600,
          imageBuffer: true,
          imageDataUrl: false,
          first: AiBrainKnowledgeIndexingService.maxOcrPages,
        });

        if (!screenshots.pages.length) {
          return extracted;
        }

        const ocrPages: ExtractedDocumentPage[] = [];
        for (const page of screenshots.pages) {
          const ocr = await this.openAiService.extractDocumentTextFromImage({
            companyId: params.companyId,
            buffer: Buffer.from(page.data),
            filename: `${params.filename}-page-${page.pageNumber}.png`,
            contentType: 'image/png',
          });

          const normalizedPageText = this.normalizeExtractedText(ocr.text);
          if (!normalizedPageText) {
            continue;
          }

          ocrPages.push({
            pageNumber: page.pageNumber,
            text: normalizedPageText,
          });
        }

        if (ocrPages.length === 0) {
          return extracted;
        }

        const fallbackText = ocrPages
          .map((page) => `Pagina ${page.pageNumber}\n${page.text}`)
          .join('\n\n');

        this.logger.log(
          `[AI KNOWLEDGE] OCR fallback used companyId=${params.companyId} filename=${params.filename} pages=${ocrPages.length}`,
        );

        return {
          text: fallbackText,
          pages: ocrPages,
        };
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
      return {
        text: parsed.value,
        pages: [],
      };
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
      return {
        text: params.buffer.toString('utf8'),
        pages: [],
      };
    }

    throw new Error(
      `knowledge_unsupported_document_type_${normalizedContentType || normalizedExtension || 'unknown'}`,
    );
  }

  private shouldUsePdfOcrFallback(extracted: ExtractedDocumentContent): boolean {
    const normalizedText = this.normalizeExtractedText(extracted.text);
    const normalizedPages = extracted.pages
      .map((page) => this.normalizeExtractedText(page.text))
      .filter((text) => text.length > 0);

    if (normalizedPages.length >= 2) {
      return false;
    }

    if (normalizedText.length >= AiBrainKnowledgeIndexingService.minUsefulPdfChars) {
      return false;
    }

    const noiseOnly = normalizedText.length > 0
      && /^((pagina \d+)|(1 of 5)|(\d+\s*(?:of|de|\/)\s*\d+)|[-\s])+$/i.test(
        normalizedText.replace(/\n+/g, ' ').trim(),
      );

    return normalizedText.length === 0 || noiseOnly || normalizedPages.length <= 1;
  }

  private normalizeExtractedText(text: string): string {
    const compact = text
      .replace(/\u0000/g, ' ')
      .replace(/\f/g, '\n')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/[ ]+\n/g, '\n')
      .replace(/\n[ ]+/g, '\n')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/^[ \t]*[-–—]{2,}[ \t]*$/gm, '')
      .replace(/^[ \t]*\d+[ \t]*(?:\/|de|of)[ \t]*\d+[ \t]*$/gim, '')
      .replace(/^[ \t]*[-–—]?[ \t]*\d+[ \t]*[-–—]?[ \t]*$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!compact) {
      return '';
    }

    return compact.slice(0, AiBrainKnowledgeIndexingService.maxDocumentChars);
  }

  private chunkText(text: string): KnowledgeChunkCandidate[] {
    return this.buildChunksFromSegments(
      this.splitIntoSegments(text).map((segment) => ({
        text: segment,
        metadata: {},
      })),
    );
  }

  private chunkDocumentPages(pages: ExtractedDocumentPage[]): KnowledgeChunkCandidate[] {
    const segments = pages.flatMap((page) =>
      this.splitIntoSegments(page.text).map((segment) => ({
        text: segment,
        metadata: {
          pageNumber: page.pageNumber,
        },
      })),
    );

    return this.buildChunksFromSegments(segments);
  }

  private buildChunksFromSegments(
    segments: Array<{ text: string; metadata: Record<string, unknown> }>,
  ): KnowledgeChunkCandidate[] {
    const chunks: KnowledgeChunkCandidate[] = [];
    let currentSegments: Array<{ text: string; metadata: Record<string, unknown> }> = [];
    let chunkIndex = 0;

    const flushCurrent = () => {
      if (currentSegments.length === 0) {
        return;
      }

      const content = currentSegments
        .map((segment, index) => this.decorateSegment(segment, index === 0))
        .join('\n\n')
        .trim();
      if (!content) {
        currentSegments = [];
        return;
      }

      const pages = Array.from(
        new Set(
          currentSegments
            .map((segment) => Number(segment.metadata['pageNumber']))
            .filter((pageNumber) => Number.isFinite(pageNumber) && pageNumber > 0),
        ),
      );

      chunks.push({
        chunkIndex,
        content,
        tokenCount: this.approximateTokenCount(content),
        metadata: {
          pageStart: pages.length > 0 ? pages[0] : null,
          pageEnd: pages.length > 0 ? pages[pages.length - 1] : null,
          pages,
        },
      });
      chunkIndex += 1;
      currentSegments = this.buildOverlapSeed(currentSegments);
    };

    for (const segment of segments) {
      const candidate = [...currentSegments, segment];
      const candidateContent = candidate
        .map((item, index) => this.decorateSegment(item, index === 0))
        .join('\n\n');

      if (
        currentSegments.length > 0 &&
        candidateContent.length > AiBrainKnowledgeIndexingService.chunkSize
      ) {
        flushCurrent();
      }

      currentSegments = [...currentSegments, segment];
    }

    flushCurrent();

    return chunks;
  }

  private splitIntoSegments(text: string): string[] {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .flatMap((segment) => this.splitLongSegment(segment));

    return paragraphs.length > 0 ? paragraphs : this.splitLongSegment(text);
  }

  private splitLongSegment(text: string): string[] {
    if (text.length <= AiBrainKnowledgeIndexingService.chunkSize) {
      return [text.trim()].filter((segment) => segment.length > 0);
    }

    const sentences = text
      .split(/(?<=[.!?;:])\s+/)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    if (sentences.length <= 1) {
      return this.forceSplitText(text);
    }

    const segments: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;
      if (
        current &&
        candidate.length > AiBrainKnowledgeIndexingService.chunkSize
      ) {
        segments.push(current.trim());
        current = sentence;
        continue;
      }
      current = candidate;
    }

    if (current.trim()) {
      segments.push(current.trim());
    }

    return segments.flatMap((segment) =>
      segment.length > AiBrainKnowledgeIndexingService.chunkSize
        ? this.forceSplitText(segment)
        : [segment],
    );
  }

  private forceSplitText(text: string): string[] {
    const parts: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + AiBrainKnowledgeIndexingService.chunkSize, text.length);
      parts.push(text.slice(start, end).trim());
      if (end >= text.length) {
        break;
      }
      start = Math.max(end - AiBrainKnowledgeIndexingService.chunkOverlap, start + 1);
    }

    return parts.filter((segment) => segment.length > 0);
  }

  private decorateSegment(
    segment: { text: string; metadata: Record<string, unknown> },
    isFirst: boolean,
  ): string {
    const pageNumber = Number(segment.metadata['pageNumber']);
    if (isFirst && Number.isFinite(pageNumber) && pageNumber > 0) {
      return `Pagina ${pageNumber}\n${segment.text}`;
    }

    return segment.text;
  }

  private buildOverlapSeed(
    segments: Array<{ text: string; metadata: Record<string, unknown> }>,
  ): Array<{ text: string; metadata: Record<string, unknown> }> {
    const seed: Array<{ text: string; metadata: Record<string, unknown> }> = [];
    let totalLength = 0;

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      seed.unshift(segment);
      totalLength += segment.text.length;

      if (
        totalLength >= AiBrainKnowledgeIndexingService.chunkOverlap ||
        totalLength >= AiBrainKnowledgeIndexingService.minChunkSize
      ) {
        break;
      }
    }

    return seed;
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
