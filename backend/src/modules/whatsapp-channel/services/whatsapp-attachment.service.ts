import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Repository } from 'typeorm';

import { StorageService } from '../../storage/storage.service';
import { WhatsappAttachmentEntity } from '../entities/whatsapp-attachment.entity';
import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { EvolutionApiClientService } from './evolution-api-client.service';
import { FfmpegRuntimeService } from './ffmpeg-runtime.service';

@Injectable()
export class WhatsappAttachmentService {
  private readonly logger = new Logger(WhatsappAttachmentService.name);

  constructor(
    @InjectRepository(WhatsappAttachmentEntity)
    private readonly attachmentsRepository: Repository<WhatsappAttachmentEntity>,
    private readonly storageService: StorageService,
    private readonly evolutionApiClient: EvolutionApiClientService,
    private readonly ffmpegRuntimeService: FfmpegRuntimeService,
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

    if (params.fileType === 'audio') {
      this.logger.log(
        `[WHATSAPP ATTACHMENT] audio received source=manual companyId=${params.companyId} bytes=${params.buffer.length} file=${params.originalName}`,
      );
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
          contentDisposition: 'inline',
          buffer: preparedUpload.buffer,
        })
      : await this.storageService.uploadBuffer({
          companyId: params.companyId,
          folder: 'media',
          filename: preparedUpload.originalName,
          contentType: preparedUpload.mimeType ?? undefined,
          contentDisposition: 'inline',
          buffer: preparedUpload.buffer,
        });

    await this.storageService.verifyObjectDownload({
      companyId: params.companyId,
      key: uploaded.key,
      expectedContentType: preparedUpload.mimeType,
      expectedContentDisposition: 'inline',
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

      if (params.fileType === 'audio') {
        this.logger.log(
          `[WHATSAPP ATTACHMENT] audio received source=inbound companyId=${params.companyId} messageId=${params.messageId} bytes=${downloaded.buffer.length} file=${params.originalName}`,
        );
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
        contentDisposition: 'inline',
        buffer: preparedUpload.buffer,
      });

      await this.storageService.verifyObjectDownload({
        companyId: params.companyId,
        key: mediaKey,
        expectedContentType: resolvedMimeType,
        expectedContentDisposition: 'inline',
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

  async findStoredByMessageId(
    companyId: string,
    messageId: string,
  ): Promise<{
    storagePath: string;
    thumbnailStoragePath: string | null;
    mimeType: string | null;
    sizeBytes: string | null;
    originalName: string | null;
    durationSeconds: number | null;
  } | null> {
    const entity = await this.attachmentsRepository.findOne({
      where: { companyId, messageId },
      order: { createdAt: 'DESC' },
    });
    if (!entity) {
      return null;
    }

    return {
      storagePath: entity.storagePath,
      thumbnailStoragePath: this.readString(entity.metadataJson['thumbnailStoragePath']) || null,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes,
      originalName: entity.originalName,
      durationSeconds: this.readOptionalNumber(entity.metadataJson['durationSeconds']),
    };
  }

  async repairStoredMessageMedia(params: {
    companyId: string;
    conversationId: string;
    messageId: string;
    fileType: string;
    mimeType?: string | null;
    originalName?: string | null;
  }): Promise<{
    storagePath: string;
    thumbnailStoragePath: string | null;
    mimeType: string | null;
    sizeBytes: string | null;
    originalName: string | null;
    durationSeconds: number | null;
  } | null> {
    const entity = await this.attachmentsRepository.findOne({
      where: { companyId: params.companyId, messageId: params.messageId },
      order: { createdAt: 'DESC' },
    });
    if (!entity) {
      return null;
    }

    let storedObject: { buffer: Buffer; contentType: string | null };
    try {
      storedObject = await this.storageService.getObjectBuffer({
        companyId: params.companyId,
        key: entity.storagePath,
      });
    } catch (_error) {
      return null;
    }

    const declaredMimeType = storedObject.contentType ?? entity.mimeType ?? params.mimeType ?? null;
    const originalName = entity.originalName ?? params.originalName ?? `${params.fileType}-${params.messageId}`;
    const currentExtension = extname(entity.storagePath).replace('.', '').trim().toLowerCase();
    const decodedBase64 = this.tryDecodeBase64Payload(storedObject.buffer);
    const containsStructuredText = this.looksLikeStructuredTextPayload(storedObject.buffer, declaredMimeType);

    const preparedUpload = await this.prepareUploadPayload({
      buffer: storedObject.buffer,
      originalName,
      mimeType: declaredMimeType,
      fileType: params.fileType,
    });

    const resolvedExtension = this.resolveExtension(
      preparedUpload.originalName,
      preparedUpload.mimeType,
      params.fileType,
    );
    const nextStoragePath = this.buildMessageStorageKey(
      params.companyId,
      params.conversationId,
      params.messageId,
      resolvedExtension,
    );

    const needsRepair =
      entity.storagePath !== nextStoragePath ||
      currentExtension !== resolvedExtension ||
      decodedBase64 != null ||
      containsStructuredText ||
      (preparedUpload.mimeType ?? null) !== (declaredMimeType ?? null) ||
      (entity.originalName ?? null) !== preparedUpload.originalName;

    if (!needsRepair) {
      return {
        storagePath: entity.storagePath,
        thumbnailStoragePath: this.readString(entity.metadataJson['thumbnailStoragePath']) || null,
        mimeType: entity.mimeType,
        sizeBytes: entity.sizeBytes,
        originalName: entity.originalName,
        durationSeconds: this.readOptionalNumber(entity.metadataJson['durationSeconds']),
      };
    }

    await this.storageService.uploadBufferToKey({
      companyId: params.companyId,
      key: nextStoragePath,
      contentType: preparedUpload.mimeType ?? undefined,
      contentDisposition: 'inline',
      buffer: preparedUpload.buffer,
    });

    await this.storageService.verifyObjectDownload({
      companyId: params.companyId,
      key: nextStoragePath,
      expectedContentType: preparedUpload.mimeType,
      expectedContentDisposition: 'inline',
    });

    const thumbnailStoragePath = await this.createUploadThumbnail(
      params.companyId,
      params.conversationId,
      params.messageId,
      params.fileType,
      preparedUpload.mimeType,
      preparedUpload.buffer,
      nextStoragePath,
      preparedUpload.originalName,
      null,
    );

    entity.storagePath = nextStoragePath;
    entity.mimeType = preparedUpload.mimeType;
    entity.originalName = preparedUpload.originalName;
    entity.sizeBytes = String(preparedUpload.buffer.length);
    entity.metadataJson = {
      ...entity.metadataJson,
      thumbnailStoragePath,
      repairedAt: new Date().toISOString(),
      ...(preparedUpload.durationSeconds != null
        ? { durationSeconds: preparedUpload.durationSeconds }
        : {}),
    };

    const saved = await this.attachmentsRepository.save(entity);

    return {
      storagePath: saved.storagePath,
      thumbnailStoragePath: this.readString(saved.metadataJson['thumbnailStoragePath']) || null,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      originalName: saved.originalName,
      durationSeconds: this.readOptionalNumber(saved.metadataJson['durationSeconds']),
    };
  }

  private async resolveInboundDownload(params: {
    config: WhatsappChannelConfigEntity;
    fileType: string;
    mimeType?: string | null;
    sourceUrl?: string | null;
    messagePayload: Record<string, unknown>;
  }): Promise<{ buffer: Buffer; contentType: string | null } | null> {
    if (params.fileType === 'audio') {
      this.logger.log(
        `[WHATSAPP ATTACHMENT] audio download attempt sourceUrl=${params.sourceUrl ?? '(none)'} mimeType=${params.mimeType ?? '(none)'}`,
      );
    }
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

    if (params.fileType === 'audio') {
      this.logger.log(
        `[WHATSAPP ATTACHMENT] audio download fallback source=message-endpoint mimeType=${params.mimeType ?? '(none)'}`,
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

    if (fileType === 'image') {
      return this.looksLikeSupportedImage(value.buffer, resolvedMimeType);
    }

    if (fileType === 'video') {
      return this.looksLikePlayableVideo(value.buffer, resolvedMimeType);
    }

    if (fileType === 'audio') {
      return this.looksLikePlayableAudio(value.buffer, resolvedMimeType);
    }

    return true;
  }

  private looksLikeSupportedImage(buffer: Buffer, mimeType: string | null): boolean {
    if (!buffer.length) {
      return false;
    }

    const normalizedMimeType = mimeType?.toLowerCase() ?? '';
    const detectedMimeType = this.detectMimeTypeFromBuffer(buffer, 'image');
    if (
      detectedMimeType &&
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(detectedMimeType)
    ) {
      return true;
    }

    if (normalizedMimeType.startsWith('image/') && normalizedMimeType !== 'application/octet-stream') {
      return Boolean(detectedMimeType);
    }

    return false;
  }

  private looksLikePlayableAudio(buffer: Buffer, mimeType: string | null): boolean {
    if (!buffer.length) {
      return false;
    }

    const normalizedMimeType = mimeType?.toLowerCase() ?? '';
    if (
      normalizedMimeType.startsWith('audio/') &&
      !this.looksLikeStructuredTextPayload(buffer, mimeType) &&
      normalizedMimeType !== 'application/octet-stream'
    ) {
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

    return false;
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
    const normalizedSource = this.normalizeInboundPayload({
      buffer: params.buffer,
      originalName: params.originalName,
      mimeType: params.mimeType,
      fileType: params.fileType,
    });

    if (params.fileType !== 'audio') {
      if (params.fileType === 'video') {
        const normalizedVideo = await this.normalizeVideoBuffer({
          buffer: normalizedSource.buffer,
          originalName: normalizedSource.originalName,
          mimeType: normalizedSource.mimeType,
        });

        if (normalizedVideo) {
          return normalizedVideo;
        }

        if (!this.looksLikePlayableVideo(normalizedSource.buffer, normalizedSource.mimeType)) {
          throw new BadRequestException('El archivo enviado no contiene un video valido.');
        }

        const detectedVideoMimeType = this.resolveMimeType(
          normalizedSource.buffer,
          normalizedSource.mimeType,
          'video',
        );
        if (detectedVideoMimeType !== 'video/mp4') {
          throw new BadRequestException('No se pudo normalizar el video a MP4.');
        }

        return {
          buffer: normalizedSource.buffer,
          originalName: this.ensureCanonicalFileName(
            normalizedSource.originalName,
            'video/mp4',
            'video',
          ),
          mimeType: 'video/mp4',
          durationSeconds: null,
        };
      }

      return {
        buffer: normalizedSource.buffer,
        originalName: normalizedSource.originalName,
        mimeType: normalizedSource.mimeType,
        durationSeconds: null,
      };
    }

    const normalizedAudio = await this.normalizeAudioBuffer({
      buffer: normalizedSource.buffer,
      originalName: normalizedSource.originalName,
      mimeType: normalizedSource.mimeType,
    });
    if (!normalizedAudio) {
      return {
        buffer: normalizedSource.buffer,
        originalName: this.ensureAudioFileName(normalizedSource.originalName, normalizedSource.mimeType),
        mimeType: normalizedSource.mimeType,
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
      contentDisposition: 'inline',
      buffer: thumbnailBuffer,
    });

    return thumbnailKey;
  }

  private async normalizeVideoBuffer(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string | null;
  }): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string | null;
    durationSeconds: number | null;
  } | null> {
    let ffmpegExecutable = '';
    try {
      ffmpegExecutable = await this.ffmpegRuntimeService.getExecutableOrThrow();
    } catch {
      this.logger.warn('[VIDEO NORMALIZATION] skipped reason=missing_ffmpeg');
      return null;
    }

    if (!this.looksLikePlayableVideo(params.buffer, params.mimeType)) {
      return null;
    }
    const inputExtension = this.resolveExtension(
      params.originalName,
      params.mimeType,
      'video',
    );
    const tempDir = await mkdtemp(join(tmpdir(), 'botposvendedor-video-'));
    const inputPath = join(tempDir, `input.${inputExtension}`);
    const outputPath = join(tempDir, 'output.mp4');

    try {
      await writeFile(inputPath, params.buffer);

      await new Promise<void>((resolve, reject) => {
        let collected = '';
        const child = spawn(
          ffmpegExecutable,
          [
            '-y',
            '-i',
            inputPath,
            '-movflags',
            '+faststart',
            '-pix_fmt',
            'yuv420p',
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '28',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
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
            resolve();
            return;
          }

          reject(new Error(collected || `ffmpeg exited with code ${code}`));
        });
      });

      return {
        buffer: await readFile(outputPath),
        originalName: this.ensureCanonicalFileName(params.originalName, 'video/mp4', 'video'),
        mimeType: 'video/mp4',
        durationSeconds: null,
      };
    } catch (error) {
      this.logger.warn(
        `[VIDEO NORMALIZATION] failed file=${params.originalName} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private normalizeInboundPayload(params: {
    buffer: Buffer;
    originalName: string;
    mimeType: string | null;
    fileType: string;
  }): {
    buffer: Buffer;
    originalName: string;
    mimeType: string | null;
  } {
    const normalizedMimeType = this.normalizeMimeType(params.mimeType);
    const decodedBase64 = this.tryDecodeBase64Payload(params.buffer);
    const resolvedBuffer = decodedBase64?.buffer ?? params.buffer;
    const resolvedMimeType = this.resolveMimeType(
      resolvedBuffer,
      decodedBase64?.mimeType ?? normalizedMimeType,
      params.fileType,
    );
    const resolvedOriginalName = this.ensureCanonicalFileName(
      params.originalName,
      resolvedMimeType,
      params.fileType,
    );

    if (
      ['image', 'video', 'audio'].includes(params.fileType) &&
      this.looksLikeStructuredTextPayload(resolvedBuffer, resolvedMimeType)
    ) {
      throw new BadRequestException('El archivo multimedia no contiene datos binarios validos.');
    }

    return {
      buffer: resolvedBuffer,
      originalName: resolvedOriginalName,
      mimeType: resolvedMimeType,
    };
  }

  private looksLikePlayableVideo(buffer: Buffer, mimeType: string | null): boolean {
    if (!buffer.length) {
      return false;
    }

    const normalizedMimeType = mimeType?.toLowerCase() ?? '';
    if (
      normalizedMimeType.startsWith('video/') &&
      normalizedMimeType !== 'application/octet-stream' &&
      !this.looksLikeStructuredTextPayload(buffer, mimeType)
    ) {
      return true;
    }

    if (buffer.length >= 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
      return true;
    }

    if (
      buffer.length >= 4 &&
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    ) {
      return true;
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 11).toString('ascii') === 'AVI'
    ) {
      return true;
    }

    return false;
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
    let ffmpegExecutable = '';
    try {
      ffmpegExecutable = await this.ffmpegRuntimeService.getExecutableOrThrow();
    } catch (error) {
      this.logger.error(
        `[AUDIO NORMALIZATION] failed file=${params.originalName} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
      return null;
    }

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
      this.logger.log(`[AUDIO NORMALIZATION] file_path=${inputPath}`);
      if (!existsSync(inputPath)) {
        throw new Error('AUDIO FILE NOT FOUND - DOWNLOAD FAILED');
      }
      this.logger.log(
        `[AUDIO NORMALIZATION] converting file=${params.originalName} inputExtension=${inputExtension}`,
      );

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
      if (!existsSync(outputPath)) {
        throw new Error('AUDIO FILE NOT FOUND - DOWNLOAD FAILED');
      }
      this.logger.log(
        `[AUDIO NORMALIZATION] converted file=${params.originalName} output=mp3 bytes=${outputBuffer.length}`,
      );
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
    if (this.resolveNamedExtension(originalName, 'audio')) {
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
    let ffmpegExecutable = '';
    try {
      ffmpegExecutable = await this.ffmpegRuntimeService.getExecutableOrThrow();
    } catch {
      return null;
    }

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
    const fromName = this.resolveNamedExtension(originalName, fileType);
    if (fromName) {
      return fromName;
    }

    const normalizedMimeType = mimeType?.split(';')[0]?.trim().toLowerCase() ?? null;

    switch (normalizedMimeType) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      case 'video/mp4':
        return 'mp4';
      case 'video/webm':
        return 'webm';
      case 'video/quicktime':
        return 'mov';
      case 'video/x-matroska':
        return 'mkv';
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

  private resolveNamedExtension(originalName: string, fileType: string): string | null {
    const fromName = extname(originalName).replace('.', '').trim().toLowerCase();
    if (!fromName) {
      return null;
    }

    switch (fileType) {
      case 'image':
        if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromName)) {
          return null;
        }
        return fromName === 'jpeg' ? 'jpg' : fromName;
      case 'video':
        return ['mp4', 'webm', 'mov', 'mkv'].includes(fromName) ? fromName : null;
      case 'audio':
        if (!['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wav'].includes(fromName)) {
          return null;
        }
        return fromName === 'opus' ? 'ogg' : fromName;
      default:
        return fromName.length >= 2 ? fromName : null;
    }
  }

  private ensureCanonicalFileName(
    originalName: string,
    mimeType: string | null,
    fileType: string,
  ): string {
    const trimmed = originalName.trim();
    const fallbackBaseName = fileType === 'audio' ? 'voice-note' : `${fileType}-file`;
    const baseName = trimmed.replace(/\.[^.]+$/, '').trim() || fallbackBaseName;
    const extension = this.resolveExtension(trimmed || fallbackBaseName, mimeType, fileType);
    return `${baseName}.${extension}`;
  }

  private normalizeMimeType(value: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    return trimmed.split(';')[0]?.trim().toLowerCase() ?? null;
  }

  private resolveMimeType(buffer: Buffer, mimeType: string | null, fileType: string): string | null {
    const normalized = this.normalizeMimeType(mimeType);
    const detectedFromBuffer = this.detectMimeTypeFromBuffer(buffer, fileType);
    if (this.isMimeTypeCompatible(detectedFromBuffer, fileType)) {
      return detectedFromBuffer;
    }

    if (this.isMimeTypeCompatible(normalized, fileType)) {
      switch (normalized) {
        case 'image/jpg':
          return 'image/jpeg';
        case 'audio/mp3':
          return 'audio/mpeg';
        case 'audio/opus':
          return 'audio/ogg';
        case 'audio/x-wav':
          return 'audio/wav';
        default:
          return normalized;
      }
    }

    return this.fallbackMimeTypeFromBuffer(buffer, fileType) ?? normalized;
  }

  private detectMimeTypeFromBuffer(buffer: Buffer, fileType: string): string | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }

    if (buffer.length >= 6) {
      const gifHeader = buffer.subarray(0, 6).toString('ascii');
      if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
        return 'image/gif';
      }
    }

    if (buffer.length >= 4 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
      return fileType === 'audio' ? 'audio/mp4' : 'video/mp4';
    }

    if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
      return 'audio/ogg';
    }

    if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') {
      return 'audio/mpeg';
    }

    if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
      return 'audio/mpeg';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE'
    ) {
      return 'audio/wav';
    }

    return null;
  }

  private fallbackMimeTypeFromBuffer(buffer: Buffer, fileType: string): string | null {
    const detected = this.detectMimeTypeFromBuffer(buffer, fileType);
    if (detected) {
      return detected;
    }

    if (fileType === 'image') {
      return 'image/jpeg';
    }
    if (fileType === 'video') {
      return 'video/mp4';
    }
    if (fileType === 'audio') {
      return 'audio/mpeg';
    }

    return null;
  }

  private isMimeTypeCompatible(mimeType: string | null, fileType: string): boolean {
    if (!mimeType) {
      return false;
    }

    switch (fileType) {
      case 'image':
        return mimeType.startsWith('image/');
      case 'video':
        return mimeType.startsWith('video/');
      case 'audio':
        return mimeType.startsWith('audio/');
      default:
        return true;
    }
  }

  private tryDecodeBase64Payload(
    buffer: Buffer,
  ): { buffer: Buffer; mimeType: string | null } | null {
    if (!buffer.length) {
      return null;
    }

    const text = buffer.toString('utf8').trim();
    if (!text) {
      return null;
    }

    let mimeType: string | null = null;
    let normalized = text;
    const dataUrlMatch = /^data:([^;]+);base64,([\s\S]+)$/i.exec(text);
    if (dataUrlMatch) {
      mimeType = this.normalizeMimeType(dataUrlMatch[1] ?? null);
      normalized = dataUrlMatch[2] ?? '';
    }

    normalized = normalized.replace(/\s+/g, '');
    const minimumLength = dataUrlMatch ? 8 : 32;
    if (normalized.length < minimumLength || !/^[A-Za-z0-9+/=]+$/.test(normalized)) {
      return null;
    }

    try {
      const decoded = Buffer.from(normalized, 'base64');
      if (!decoded.length || decoded.equals(buffer)) {
        return null;
      }

      return {
        buffer: decoded,
        mimeType,
      };
    } catch {
      return null;
    }
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readOptionalNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.round(parsed));
      }
    }

    return null;
  }
}
