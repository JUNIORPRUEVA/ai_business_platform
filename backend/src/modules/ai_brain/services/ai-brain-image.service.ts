import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MessageEntity } from '../../messages/entities/message.entity';
import { OpenAiService } from '../../openai/services/openai.service';
import { StorageService } from '../../storage/storage.service';
import { WhatsappMessageEntity } from '../../whatsapp-channel/entities/whatsapp-message.entity';

@Injectable()
export class AiBrainImageService {
  private static readonly analysisFallback =
    'El cliente envió una imagen, pero hubo un problema técnico analizándola.';
  private readonly logger = new Logger(AiBrainImageService.name);

  constructor(
    @InjectRepository(WhatsappMessageEntity)
    private readonly whatsappMessagesRepository: Repository<WhatsappMessageEntity>,
    private readonly storageService: StorageService,
    private readonly openAiService: OpenAiService,
  ) {}

  async resolveInboundImageText(params: {
    companyId: string;
    message: MessageEntity;
  }): Promise<{
    content: string;
    metadataPatch: Record<string, unknown>;
  }> {
    try {
      this.logger.log(
        `[AI IMAGE] IMAGE RECEIVED companyId=${params.companyId} messageId=${params.message.id}`,
      );

      const source = await this.resolveImageSource(params.companyId, params.message);
      if (!source) {
        throw new Error('image_source_not_found');
      }

      this.logger.log(
        `[AI IMAGE] IMAGE DOWNLOADED companyId=${params.companyId} messageId=${params.message.id} file=${source.filename} bytes=${source.buffer.length} contentType=${source.contentType ?? '(none)'}`,
      );

      const analysis = await this.openAiService.describeImage({
        companyId: params.companyId,
        buffer: source.buffer,
        filename: source.filename,
        contentType: source.contentType ?? params.message.mimeType ?? 'image/jpeg',
      });
      const text = analysis.text.trim();
      if (!text) {
        throw new Error('empty_image_analysis');
      }

      const content = this.buildResolvedImageContent(params.message.content, text);
      this.logger.log(
        `[AI IMAGE] ANALYSIS RESULT companyId=${params.companyId} messageId=${params.message.id} text="${text.slice(0, 200)}"`,
      );

      return {
        content,
        metadataPatch: {
          imageAnalysis: {
            status: 'completed',
            text,
            content,
            model: analysis.model,
          },
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(
        `[AI IMAGE] analysis failed companyId=${params.companyId} messageId=${params.message.id} reason=${reason}`,
      );

      return {
        content: this.buildResolvedImageContent(params.message.content, AiBrainImageService.analysisFallback),
        metadataPatch: {
          imageAnalysis: {
            status: 'failed',
            error: reason,
            fallback: AiBrainImageService.analysisFallback,
            content: this.buildResolvedImageContent(
              params.message.content,
              AiBrainImageService.analysisFallback,
            ),
          },
        },
      };
    }
  }

  private async resolveImageSource(
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
          sourceLabel: 'whatsapp_message',
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
      sourceLabel: 'message_media_url',
    });
  }

  private async resolveStoredAsset(params: {
    companyId: string;
    candidate: string | null;
    filename: string;
    mimeType?: string | null;
    sourceLabel: string;
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
      if (this.looksLikeImage(stored.buffer, stored.contentType ?? params.mimeType ?? null)) {
        return {
          buffer: stored.buffer,
          filename: params.filename,
          contentType: stored.contentType ?? params.mimeType ?? null,
        };
      }

      this.logger.warn(
        `[AI IMAGE] invalid image payload source=${params.sourceLabel} mode=storage key=${trimmed} contentType=${stored.contentType ?? params.mimeType ?? '(none)'} bytes=${stored.buffer.length}`,
      );
      return null;
    }

    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`image_download_failed_${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type');
    if (!this.looksLikeImage(buffer, contentType ?? params.mimeType ?? null)) {
      throw new Error(`image_download_invalid_payload_${contentType ?? params.mimeType ?? 'unknown'}`);
    }

    return {
      buffer,
      filename: params.filename,
      contentType,
    };
  }

  private buildResolvedImageContent(originalContent: string, analysis: string): string {
    const normalizedOriginal = originalContent.trim();
    if (normalizedOriginal && !this.isGenericImagePlaceholder(normalizedOriginal)) {
      return `El cliente envió una imagen con este texto adjunto: "${normalizedOriginal}". Análisis visual: ${analysis}`;
    }

    return `El cliente envió una imagen. Análisis visual: ${analysis}`;
  }

  private isGenericImagePlaceholder(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    return normalized === 'image recibido' || normalized === 'imagen recibida';
  }

  private looksLikeImage(buffer: Buffer, mimeType: string | null): boolean {
    if (!buffer.length) {
      return false;
    }

    const normalizedMimeType = mimeType?.toLowerCase() ?? '';
    if (normalizedMimeType.startsWith('image/') && normalizedMimeType !== 'application/octet-stream') {
      return true;
    }

    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return true;
    }
    if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
      return true;
    }
    if (buffer.subarray(0, 3).toString('ascii') === 'GIF') {
      return true;
    }

    return false;
  }

  private extensionFromMimeType(mimeType: string | null): string {
    switch ((mimeType ?? '').toLowerCase()) {
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      default:
        return '.jpg';
    }
  }
}
