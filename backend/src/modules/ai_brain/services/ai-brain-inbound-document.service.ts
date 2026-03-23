import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { basename, extname } from 'node:path';
import { Repository } from 'typeorm';

import { MessageEntity } from '../../messages/entities/message.entity';
import { StorageService } from '../../storage/storage.service';
import { WhatsappMessageEntity } from '../../whatsapp-channel/entities/whatsapp-message.entity';

@Injectable()
export class AiBrainInboundDocumentService {
  private static readonly extractionFallback =
    'El cliente envió un documento, pero hubo un problema técnico leyéndolo.';
  private static readonly maxExtractedChars = 6000;
  private readonly logger = new Logger(AiBrainInboundDocumentService.name);

  constructor(
    @InjectRepository(WhatsappMessageEntity)
    private readonly whatsappMessagesRepository: Repository<WhatsappMessageEntity>,
    private readonly storageService: StorageService,
  ) {}

  async resolveInboundDocumentText(params: {
    companyId: string;
    message: MessageEntity;
  }): Promise<{
    content: string;
    metadataPatch: Record<string, unknown>;
  }> {
    try {
      this.logger.log(
        `[AI DOCUMENT] DOCUMENT RECEIVED companyId=${params.companyId} messageId=${params.message.id}`,
      );

      const source = await this.resolveDocumentSource(params.companyId, params.message);
      if (!source) {
        throw new Error('document_source_not_found');
      }

      const extractedText = await this.extractTextFromDocument(source);
      const compactText = this.compactExtractedText(extractedText);
      if (!compactText) {
        throw new Error('empty_document_text');
      }

      const content = this.buildResolvedDocumentContent(
        params.message.content,
        source.filename,
        compactText,
      );
      const businessSummary = this.extractBusinessSummary(compactText);

      this.logger.log(
        `[AI DOCUMENT] DOCUMENT EXTRACTED companyId=${params.companyId} messageId=${params.message.id} file=${source.filename} contentType=${source.contentType ?? '(none)'} chars=${compactText.length}`,
      );

      return {
        content,
        metadataPatch: {
          documentAnalysis: {
            status: 'completed',
            text: compactText,
            content,
            contentType: source.contentType,
            fileName: source.filename,
            businessSummary,
          },
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(
        `[AI DOCUMENT] extraction failed companyId=${params.companyId} messageId=${params.message.id} reason=${reason}`,
      );

      const content = this.buildResolvedDocumentContent(
        params.message.content,
        params.message.fileName ?? null,
        AiBrainInboundDocumentService.extractionFallback,
      );

      return {
        content,
        metadataPatch: {
          documentAnalysis: {
            status: 'failed',
            error: reason,
            fallback: AiBrainInboundDocumentService.extractionFallback,
            content,
            fileName: params.message.fileName ?? null,
          },
        },
      };
    }
  }

  private async resolveDocumentSource(
    companyId: string,
    message: MessageEntity,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string | null } | null> {
    const whatsappChannelMessageId =
      typeof message.metadata?.['whatsappChannelMessageId'] === 'string'
        ? String(message.metadata['whatsappChannelMessageId']).trim()
        : '';

    if (whatsappChannelMessageId) {
      const whatsappMessage = await this.whatsappMessagesRepository.findOne({
        where: { id: whatsappChannelMessageId, companyId },
      });
      if (whatsappMessage) {
        const resolved = await this.resolveStoredAsset({
          companyId,
          candidate: whatsappMessage.mediaStoragePath ?? whatsappMessage.mediaUrl,
          filename:
            whatsappMessage.mediaOriginalName?.trim() ||
            `${whatsappMessage.id}${this.extensionFromMimeType(whatsappMessage.mimeType)}`,
          mimeType: whatsappMessage.mimeType,
        });
        if (resolved) {
          return resolved;
        }
      }
    }

    return this.resolveStoredAsset({
      companyId,
      candidate: message.mediaUrl,
      filename: message.fileName ?? `${message.id}${this.extensionFromMimeType(message.mimeType)}`,
      mimeType: message.mimeType,
    });
  }

  private async resolveStoredAsset(params: {
    companyId: string;
    candidate: string | null;
    filename: string;
    mimeType?: string | null;
  }): Promise<{ buffer: Buffer; filename: string; contentType: string | null } | null> {
    const trimmed = params.candidate?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith(`${params.companyId}/`)) {
      const stored = await this.storageService.getObjectBuffer({
        companyId: params.companyId,
        key: trimmed,
      });

      return {
        buffer: stored.buffer,
        filename: params.filename,
        contentType: stored.contentType ?? params.mimeType ?? null,
      };
    }

    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`document_download_failed_${response.status}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      filename: params.filename,
      contentType: response.headers.get('content-type') ?? params.mimeType ?? null,
    };
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
      normalizedExtension === '.csv' ||
      normalizedExtension === '.json' ||
      normalizedExtension === '.xml'
    ) {
      return params.buffer.toString('utf8');
    }

    throw new Error(
      `unsupported_document_type_${normalizedContentType || normalizedExtension || 'unknown'}`,
    );
  }

  private compactExtractedText(text: string): string {
    const normalized = text
      .replace(/\u0000/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return '';
    }

    return normalized.slice(0, AiBrainInboundDocumentService.maxExtractedChars);
  }

  private buildResolvedDocumentContent(
    originalContent: string,
    filename: string | null,
    extractedText: string,
  ): string {
    const normalizedOriginal = originalContent.trim();
    const normalizedFilename = filename?.trim() ?? '';
    const hasUsefulCaption =
      normalizedOriginal.length > 0 &&
      normalizedOriginal.toLowerCase() !== 'documento recibido' &&
      normalizedOriginal !== normalizedFilename;

    if (hasUsefulCaption) {
      return `El cliente envió un documento${normalizedFilename ? ` (${basename(normalizedFilename)})` : ''} con este texto adjunto: "${normalizedOriginal}". Texto extraído: ${extractedText}`;
    }

    return `El cliente envió un documento${normalizedFilename ? ` (${basename(normalizedFilename)})` : ''}. Texto extraído: ${extractedText}`;
  }

  private extensionFromMimeType(mimeType: string | null | undefined): string {
    const normalized = mimeType?.split(';')[0].trim().toLowerCase() ?? '';
    switch (normalized) {
      case 'application/pdf':
        return '.pdf';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return '.docx';
      case 'text/plain':
        return '.txt';
      case 'text/csv':
        return '.csv';
      case 'application/json':
        return '.json';
      default:
        return '.bin';
    }
  }

  private extractBusinessSummary(text: string): Record<string, unknown> {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const quoteNumber =
      this.capture(normalized, /\b(?:cot(?:izaci[oó]n)?|quote|invoice|factura)\s*(?:n[roúumero#.: -]*)?\s*([A-Z]{2,5}-\d{3,}|\d{4,})\b/i) ??
      this.capture(normalized, /\b([A-Z]{2,5}-\d{3,})\b/);

    const customerName =
      this.capture(normalized, /(?:cliente|señor(?:a)?|sr\.?|sra\.?|a nombre de)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\s]{3,80})/i) ??
      this.capture(normalized, /(?:raz[oó]n social|empresa)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\s.,&-]{3,80})/i);

    const totalAmount = this.capture(
      normalized,
      /(?:total|monto total|importe total|valor total)\s*[:\-]?\s*(US\$|\$|RD\$|DOP)?\s*([\d.,]+)/i,
      (match) => `${(match[1] ?? '').trim()} ${match[2]}`.trim(),
    );

    const validUntil = this.capture(
      normalized,
      /(?:v[aá]lida hasta|v[aá]lido hasta|vence|fecha de vencimiento)\s*[:\-]?\s*([0-3]?\d[\/-][01]?\d[\/-]\d{2,4})/i,
    );

    const summaryParts = [
      quoteNumber ? `cotización ${quoteNumber}` : null,
      customerName ? `a nombre de ${customerName}` : null,
      totalAmount ? `por ${totalAmount}` : null,
      validUntil ? `vigente hasta ${validUntil}` : null,
    ].filter((value): value is string => Boolean(value));

    return {
      quoteNumber: quoteNumber ?? null,
      customerName: customerName ?? null,
      totalAmount: totalAmount ?? null,
      validUntil: validUntil ?? null,
      summary: summaryParts.length > 0 ? summaryParts.join(', ') : null,
    };
  }

  private capture(
    text: string,
    pattern: RegExp,
    map?: (match: RegExpExecArray) => string,
  ): string | null {
    const matched = pattern.exec(text);
    if (!matched) {
      return null;
    }

    const value = (map ? map(matched) : matched[1] ?? '').replace(/\s+/g, ' ').trim();
    return value || null;
  }
}
