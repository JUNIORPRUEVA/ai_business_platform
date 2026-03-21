import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  private readonly logger = new Logger(WhatsappAttachmentService.name);

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

    if (
      params.fileType === 'audio' &&
      this.looksLikeStructuredTextPayload(params.buffer, params.mimeType ?? null) &&
      !this.looksLikePlayableAudio(params.buffer, params.mimeType ?? null)
    ) {
      throw new BadRequestException('El archivo enviado no contiene un audio valido.');
    }

    const preparedUpload = await this.prepareUploadPayload({
      buffer: params.buffer,
      originalName: params.originalName,
      mimeType: params.mimeType ?? null,
      fileType: params.fileType,
    });

    const draftKey = params.conversationId
      ? this.buildDraftStorageKey(
          params.companyId,
          params.conversationId,
          preparedUpload.originalName,
          preparedUpload.mimeType,
          params.fileType,
        )
      : null;

    const uploaded = draftKey
      ? await this.storageService.uploadBufferToKey({
          companyId: params.companyId,
          key: draftKey,
          contentType: preparedUpload.mimeType ?? undefined,
          buffer: preparedUpload.buffer,
        })
      : await this.storageService.uploadBuffer({
          companyId: params.companyId,
          folder: 'media',
          filename: preparedUpload.originalName,
          contentType: preparedUpload.mimeType ?? undefined,
          buffer: preparedUpload.buffer,
        });

    const thumbnailStoragePath = await this.createUploadThumbnail(
      params.companyId,
      params.conversationId,
      undefined,
      params.fileType,
      preparedUpload.mimeType,
      preparedUpload.buffer,
      uploaded.key,
      preparedUpload.originalName,
      null,
    );

    const entity = this.attachmentsRepository.create({
      companyId: params.companyId,
      messageId: null,
      fileType: params.fileType,
      mimeType: preparedUpload.mimeType,
      originalName: preparedUpload.originalName,
      storagePath: uploaded.key,
      publicUrl: null,
      sizeBytes: String(preparedUpload.buffer.length),
      metadataJson: {
        conversationId: params.conversationId ?? null,
        thumbnailStoragePath,
        ...(preparedUpload.durationSeconds != null
          ? { durationSeconds: preparedUpload.durationSeconds }
          : {}),
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
        this.logger.warn(
          `[WHATSAPP ATTACHMENT] inbound download skipped companyId=${params.companyId} messageId=${params.messageId} fileType=${params.fileType} sourceUrl=${params.sourceUrl ?? '(none)'} reason=empty_download`,
        );
        return null;
      }

      const preparedUpload = await this.prepareUploadPayload({
        buffer: downloaded.buffer,
        originalName: params.originalName,
        mimeType: params.mimeType ?? downloaded.contentType ?? null,
        fileType: params.fileType,
      });

      const resolvedMimeType = preparedUpload.mimeType;
      const mediaKey = this.buildMessageStorageKey(
        params.companyId,
        params.conversationId,
        params.messageId,
        this.resolveExtension(preparedUpload.originalName, resolvedMimeType, params.fileType),
      );

      await this.storageService.uploadBufferToKey({
        companyId: params.companyId,
        key: mediaKey,
        contentType: resolvedMimeType ?? undefined,
        buffer: preparedUpload.buffer,
      });

      const thumbnailStoragePath = await this.createUploadThumbnail(
        params.companyId,
        params.conversationId,
        params.messageId,
        params.fileType,
        resolvedMimeType,
        preparedUpload.buffer,
        mediaKey,
        preparedUpload.originalName,
        params.thumbnailSource ?? null,
      );

      const entity = this.attachmentsRepository.create({
        companyId: params.companyId,
        messageId: params.messageId,
        fileType: params.fileType,
        mimeType: resolvedMimeType,
        originalName: preparedUpload.originalName,
        storagePath: mediaKey,
        publicUrl: null,
        sizeBytes: String(preparedUpload.buffer.length),
        metadataJson: {
          ...(params.metadataJson ?? {}),
          sourceUrl: params.sourceUrl ?? null,
          thumbnailStoragePath,
          ...(preparedUpload.durationSeconds != null
            ? { durationSeconds: preparedUpload.durationSeconds }
            : {}),
        },
      });

      return this.attachmentsRepository.save(entity);
    } catch (error) {
      this.logger.warn(
        `[WHATSAPP ATTACHMENT] inbound storage failed companyId=${params.companyId} messageId=${params.messageId} fileType=${params.fileType} sourceUrl=${params.sourceUrl ?? '(none)'} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
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
    fileType: string;
    mimeType?: string | null;
    sourceUrl?: string | null;
    messagePayload: Record<string, unknown>;
  }): Promise<{ buffer: Buffer; contentType: string | null } | null> {
    const sourceDownload = params.sourceUrl
      ? await this.evolutionApiClient.downloadMediaUrl(params.config, params.sourceUrl)
      : null;

    if (this.isInboundDownloadUsable(sourceDownload, params.fileType, params.mimeType ?? null)) {
      this.logger.log(
        `[WHATSAPP ATTACHMENT] inbound download source=url fileType=${params.fileType} bytes=${sourceDownload!.buffer.length} contentType=${sourceDownload!.contentType ?? params.mimeType ?? '(none)'}`,
      );
      return {
        buffer: sourceDownload!.buffer,
        contentType: sourceDownload!.contentType,
      };
    }

    if (sourceDownload) {
      this.logger.warn(
        `[WHATSAPP ATTACHMENT] inbound download fallback source=url fileType=${params.fileType} bytes=${sourceDownload.buffer.length} contentType=${sourceDownload.contentType ?? params.mimeType ?? '(none)'}`,
      );
    }

    const mediaMessageDownload = await this.evolutionApiClient.downloadMediaMessage(
      params.config,
      params.messagePayload,
    );
    if (this.isInboundDownloadUsable(mediaMessageDownload, params.fileType, params.mimeType ?? null)) {
      this.logger.log(
        `[WHATSAPP ATTACHMENT] inbound download source=message fileType=${params.fileType} bytes=${mediaMessageDownload!.buffer.length} contentType=${mediaMessageDownload!.contentType ?? params.mimeType ?? '(none)'}`,
      );
      return {
        buffer: mediaMessageDownload!.buffer,
        contentType: mediaMessageDownload!.contentType,
      };
    }

    if (mediaMessageDownload) {
      this.logger.warn(
        `[WHATSAPP ATTACHMENT] inbound download rejected source=message fileType=${params.fileType} bytes=${mediaMessageDownload.buffer.length} contentType=${mediaMessageDownload.contentType ?? params.mimeType ?? '(none)'}`,
      );
    }

    return null;
  }

  private isInboundDownloadUsable(
    value: { buffer: Buffer; contentType: string | null } | null,
    fileType: string,
    declaredMimeType: string | null,
  ): boolean {
    if (!value || !value.buffer.length) {
      return false;
    }

    const resolvedMimeType = value.contentType ?? declaredMimeType;
    if (this.looksLikeStructuredTextPayload(value.buffer, resolvedMimeType)) {
      return false;
    }

    if (fileType !== 'audio') {
      return true;
    }

    return this.looksLikePlayableAudio(value.buffer, resolvedMimeType);
  }

  private looksLikePlayableAudio(buffer: Buffer, mimeType: string | null): boolean {
    if (!buffer.length) {
      return false;
    }

    const normalizedMimeType = mimeType?.toLowerCase() ?? '';
    if (normalizedMimeType.startsWith('audio/') && !this.looksLikeStructuredTextPayload(buffer, mimeType)) {
      return true;
    }

    if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') {
      return true;
    }

    if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
      return true;
    }

    if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
      return true;
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE'
    ) {
      return true;
    }

    if (buffer.length >= 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
      return true;
    }

    if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'fLaC') {
      return true;
    }

    return !this.looksLikeStructuredTextPayload(buffer, mimeType) && buffer.length > 512;
  }

  private looksLikeStructuredTextPayload(buffer: Buffer, mimeType: string | null): boolean {
    const normalizedMimeType = mimeType?.toLowerCase() ?? '';
    if (
      normalizedMimeType.includes('application/json') ||
      normalizedMimeType.startsWith('text/') ||
      normalizedMimeType.includes('text/html')
    ) {
      return true;
    }

    const sample = buffer.subarray(0, Math.min(buffer.length, 256)).toString('utf8').trim().toLowerCase();
    if (!sample) {
      return false;
    }

    return (
      sample.startsWith('{') ||
      sample.startsWith('[') ||
      sample.startsWith('<!doctype html') ||
      sample.startsWith('<html') ||
      sample.includes('"base64"') ||
      sample.includes('access denied')
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

  private async prepareUploadPayload(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string | null;
    fileType: string;
  }): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string | null;
    durationSeconds: number | null;
  }> {
    if (params.fileType !== 'audio') {
      return {
        buffer: params.buffer,
        originalName: params.originalName,
        mimeType: params.mimeType,
        durationSeconds: null,
      };
    }

    const normalizedAudio = await this.normalizeAudioBuffer({
      buffer: params.buffer,
      originalName: params.originalName,
      mimeType: params.mimeType,
    });
    if (!normalizedAudio) {
      return {
        buffer: params.buffer,
        originalName: this.ensureAudioFileName(params.originalName, params.mimeType),
        mimeType: params.mimeType,
        durationSeconds: null,
      };
    }

    return normalizedAudio;
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

  private async normalizeAudioBuffer(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string | null;
  }): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string | null;
    durationSeconds: number | null;
  } | null> {
    if (!ffmpegPath) {
      this.logger.warn('[AUDIO NORMALIZATION] skipped reason=missing_ffmpeg');
      return null;
    }

    const ffmpegExecutable = String(ffmpegPath);
    const inputExtension = this.resolveExtension(
      params.originalName,
      params.mimeType,
      'audio',
    );
    const tempDir = await mkdtemp(join(tmpdir(), 'botposvendedor-audio-'));
    const inputPath = join(tempDir, `input.${inputExtension}`);
    const outputPath = join(tempDir, 'output.mp3');

    try {
      await writeFile(inputPath, params.buffer);

      const stderr = await new Promise<string>((resolve, reject) => {
        let collected = '';
        const child = spawn(
          ffmpegExecutable,
          [
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-ac',
            '1',
            '-ar',
            '24000',
            '-c:a',
            'libmp3lame',
            '-b:a',
            '48k',
            outputPath,
          ],
          { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
        );

        child.stderr?.on('data', (chunk: Buffer | string) => {
          collected += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', (code: number | null) => {
          if (code === 0) {
            resolve(collected);
            return;
          }

          reject(new Error(collected || `ffmpeg exited with code ${code}`));
        });
      });

      const outputBuffer = await readFile(outputPath);
      return {
        buffer: outputBuffer,
        originalName: this.ensureMp3FileName(params.originalName),
        mimeType: 'audio/mpeg',
        durationSeconds: this.parseDurationSeconds(stderr),
      };
    } catch (error) {
      this.logger.warn(
        `[AUDIO NORMALIZATION] failed file=${params.originalName} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private ensureAudioFileName(originalName: string, mimeType: string | null): string {
    const fromName = extname(originalName).trim().toLowerCase();
    if (fromName) {
      return originalName;
    }

    const fallbackExtension = this.resolveExtension(originalName, mimeType, 'audio');
    return `${originalName}.${fallbackExtension}`;
  }

  private ensureMp3FileName(originalName: string): string {
    const baseName = originalName.replace(/\.[^.]+$/, '').trim();
    return `${baseName || 'voice-note'}.mp3`;
  }

  private parseDurationSeconds(stderr: string): number | null {
    const timeMatches = Array.from(stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g));
    const durationMatch = timeMatches.at(-1) ?? stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!durationMatch) {
      return null;
    }

    const hours = Number(durationMatch[1]);
    const minutes = Number(durationMatch[2]);
    const seconds = Number(durationMatch[3]);
    if ([hours, minutes, seconds].some((value) => Number.isNaN(value))) {
      return null;
    }

    return Math.max(1, Math.round(hours * 3600 + minutes * 60 + seconds));
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
      case 'audio/mpeg':
        return 'mp3';
      case 'audio/mp3':
        return 'mp3';
      case 'audio/mp4':
      case 'audio/m4a':
      case 'audio/aac':
        return 'm4a';
      case 'audio/ogg':
      case 'audio/opus':
        return 'ogg';
      case 'audio/wav':
      case 'audio/x-wav':
        return 'wav';
      default:
        if (fileType === 'image') {
          return 'jpg';
        }
        if (fileType === 'video') {
          return 'mp4';
        }
        if (fileType === 'audio') {
          return 'mp3';
        }
        return 'bin';
    }
  }
}