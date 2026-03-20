import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Repository } from 'typeorm';

import { StorageService } from '../../storage/storage.service';
import { WhatsappAttachmentEntity } from '../entities/whatsapp-attachment.entity';
import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { EvolutionApiClientService } from './evolution-api-client.service';

@Injectable()
export class WhatsappAttachmentService {
  constructor(
    @InjectRepository(WhatsappAttachmentEntity)
    private readonly attachmentsRepository: Repository<WhatsappAttachmentEntity>,
    private readonly storageService: StorageService,
    private readonly evolutionApiClient: EvolutionApiClientService,
  ) {}

  async uploadManual(params: {
    companyId: string;
    buffer: Buffer;
    originalName: string;
    mimeType?: string;
    fileType: string;
    conversationId?: string;
  }): Promise<WhatsappAttachmentEntity> {
    if (!params.buffer.length) {
      throw new BadRequestException('El archivo esta vacio.');
    }

    const draftKey = params.conversationId
      ? this.buildDraftStorageKey(
          params.companyId,
          params.conversationId,
          params.originalName,
          params.mimeType ?? null,
          params.fileType,
        )
      : null;

    const uploaded = draftKey
      ? await this.storageService.uploadBufferToKey({
          companyId: params.companyId,
          key: draftKey,
          contentType: params.mimeType,
          buffer: params.buffer,
        })
      : await this.storageService.uploadBuffer({
          companyId: params.companyId,
          folder: 'media',
          filename: params.originalName,
          contentType: params.mimeType,
          buffer: params.buffer,
        });

    const thumbnailStoragePath = await this.createUploadThumbnail(
      params.companyId,
      params.conversationId,
      undefined,
      params.fileType,
      params.mimeType ?? null,
      params.buffer,
      uploaded.key,
      params.originalName,
      null,
    );

    const entity = this.attachmentsRepository.create({
      companyId: params.companyId,
      messageId: null,
      fileType: params.fileType,
      mimeType: params.mimeType ?? null,
      originalName: params.originalName,
      storagePath: uploaded.key,
      publicUrl: null,
      sizeBytes: String(params.buffer.length),
      metadataJson: {
        conversationId: params.conversationId ?? null,
        thumbnailStoragePath,
      },
    });

    return this.attachmentsRepository.save(entity);
  }

  async bindToMessage(attachmentId: string, messageId: string): Promise<void> {
    await this.attachmentsRepository.update({ id: attachmentId }, { messageId });
  }

  async downloadRemoteToStorage(params: {
    config: WhatsappChannelConfigEntity;
    companyId: string;
    conversationId: string;
    messageId: string;
    fileType: string;
    mimeType?: string | null;
    originalName: string;
    sourceUrl?: string | null;
    thumbnailSource?: string | null;
    messagePayload: Record<string, unknown>;
    metadataJson?: Record<string, unknown>;
  }): Promise<WhatsappAttachmentEntity | null> {
    try {
      const downloaded = await this.resolveInboundDownload(params);
      if (!downloaded || !downloaded.buffer.length) {
        return null;
      }

      const resolvedMimeType = params.mimeType ?? downloaded.contentType ?? null;
      const mediaKey = this.buildMessageStorageKey(
        params.companyId,
        params.conversationId,
        params.messageId,
        this.resolveExtension(params.originalName, resolvedMimeType, params.fileType),
      );

      await this.storageService.uploadBufferToKey({
        companyId: params.companyId,
        key: mediaKey,
        contentType: resolvedMimeType ?? undefined,
        buffer: downloaded.buffer,
      });

      const thumbnailStoragePath = await this.createUploadThumbnail(
        params.companyId,
        params.conversationId,
        params.messageId,
        params.fileType,
        resolvedMimeType,
        downloaded.buffer,
        mediaKey,
        params.originalName,
        params.thumbnailSource ?? null,
      );

      const entity = this.attachmentsRepository.create({
        companyId: params.companyId,
        messageId: params.messageId,
        fileType: params.fileType,
        mimeType: resolvedMimeType,
        originalName: params.originalName,
        storagePath: mediaKey,
        publicUrl: null,
        sizeBytes: String(downloaded.buffer.length),
        metadataJson: {
          ...(params.metadataJson ?? {}),
          sourceUrl: params.sourceUrl ?? null,
          thumbnailStoragePath,
        },
      });

      return this.attachmentsRepository.save(entity);
    } catch (_error) {
      return null;
    }
  }

  async getDownload(
    companyId: string,
    attachmentId: string,
  ): Promise<{ id: string; key: string; url: string }> {
    const entity = await this.attachmentsRepository.findOne({
      where: { id: attachmentId, companyId },
    });
    if (!entity) {
      throw new NotFoundException('Adjunto no encontrado.');
    }

    const signed = await this.storageService.presignDownload({
      companyId,
      key: entity.storagePath,
    });

    return {
      id: entity.id,
      key: entity.storagePath,
      url: signed.url,
    };
  }

  async getById(companyId: string, attachmentId: string): Promise<WhatsappAttachmentEntity> {
    const entity = await this.attachmentsRepository.findOne({
      where: { id: attachmentId, companyId },
    });
    if (!entity) {
      throw new NotFoundException('Adjunto no encontrado.');
    }

    return entity;
  }

  private async resolveInboundDownload(params: {
    config: WhatsappChannelConfigEntity;
    sourceUrl?: string | null;
    messagePayload: Record<string, unknown>;
  }): Promise<{ buffer: Buffer; contentType: string | null } | null> {
    return (
      (params.sourceUrl
        ? await this.evolutionApiClient.downloadMediaUrl(params.config, params.sourceUrl)
        : null) ??
      (await this.evolutionApiClient.downloadMediaMessage(params.config, params.messagePayload))
    );
  }

  private buildDraftStorageKey(
    companyId: string,
    conversationId: string,
    originalName: string,
    mimeType: string | null,
    fileType: string,
  ): string {
    const extension = this.resolveExtension(originalName, mimeType, fileType);
    return `${companyId}/chat/${conversationId}/draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  }

  private buildMessageStorageKey(
    companyId: string,
    conversationId: string,
    messageId: string,
    extension: string,
  ): string {
    return `${companyId}/chat/${conversationId}/${messageId}.${extension}`;
  }

  private buildMessageThumbnailKey(
    companyId: string,
    conversationId: string,
    messageId: string,
  ): string {
    return `${companyId}/chat/${conversationId}/${messageId}-thumbnail.jpg`;
  }

  private async createUploadThumbnail(
    companyId: string,
    conversationId: string | undefined,
    messageId: string | undefined,
    fileType: string,
    mimeType: string | null,
    mediaBuffer: Buffer,
    mediaStoragePath: string,
    originalName: string,
    thumbnailSource: string | null,
  ): Promise<string | null> {
    if (fileType === 'image') {
      return mediaStoragePath;
    }

    if (fileType !== 'video') {
      return null;
    }

    const thumbnailBuffer =
      this.decodeThumbnailSource(thumbnailSource) ??
      (await this.generateVideoThumbnail(mediaBuffer, originalName, mimeType));
    if (!thumbnailBuffer?.length) {
      return null;
    }

    const thumbnailKey = conversationId && messageId
      ? this.buildMessageThumbnailKey(companyId, conversationId, messageId)
      : `${companyId}/media/video-thumbnail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    await this.storageService.uploadBufferToKey({
      companyId,
      key: thumbnailKey,
      contentType: 'image/jpeg',
      buffer: thumbnailBuffer,
    });

    return thumbnailKey;
  }

  private decodeThumbnailSource(value: string | null): Buffer | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.startsWith('data:')
      ? (trimmed.split(',').pop() ?? '')
      : trimmed;

    try {
      const decoded = Buffer.from(normalized, 'base64');
      return decoded.length > 0 ? decoded : null;
    } catch (_error) {
      return null;
    }
  }

  private async generateVideoThumbnail(
    mediaBuffer: Buffer,
    originalName: string,
    mimeType: string | null,
  ): Promise<Buffer | null> {
    if (!ffmpegPath) {
      return null;
    }

    const ffmpegExecutable = String(ffmpegPath);
    const extension = this.resolveExtension(originalName, mimeType, 'video');
    const tempDir = await mkdtemp(join(tmpdir(), 'botposvendedor-video-thumb-'));
    const inputPath = join(tempDir, `input.${extension}`);
    const outputPath = join(tempDir, 'thumbnail.jpg');

    try {
      await writeFile(inputPath, mediaBuffer);

      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          ffmpegExecutable,
          ['-y', '-i', inputPath, '-frames:v', '1', '-q:v', '2', outputPath],
          { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
        );

        let stderr = '';
        child.stderr?.on('data', (chunk: Buffer | string) => {
          stderr += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (code: number | null) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(new Error(stderr || `ffmpeg exited with code ${code}`));
        });
      });

      return await readFile(outputPath);
    } catch (_error) {
      return null;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private resolveExtension(
    originalName: string,
    mimeType: string | null,
    fileType: string,
  ): string {
    const fromName = extname(originalName).replace('.', '').trim().toLowerCase();
    if (fromName) {
      return fromName;
    }

    switch (mimeType?.toLowerCase()) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'video/mp4':
        return 'mp4';
      case 'video/webm':
        return 'webm';
      case 'video/quicktime':
        return 'mov';
      default:
        return fileType === 'image' ? 'jpg' : fileType === 'video' ? 'mp4' : 'bin';
    }
  }
}