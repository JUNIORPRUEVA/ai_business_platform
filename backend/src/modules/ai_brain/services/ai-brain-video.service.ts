import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Repository } from 'typeorm';

import { MessageEntity } from '../../messages/entities/message.entity';
import { OpenAiService } from '../../openai/services/openai.service';
import { StorageService } from '../../storage/storage.service';
import { WhatsappMessageEntity } from '../../whatsapp-channel/entities/whatsapp-message.entity';
import { EvolutionApiClientService } from '../../whatsapp-channel/services/evolution-api-client.service';
import { FfmpegRuntimeService } from '../../whatsapp-channel/services/ffmpeg-runtime.service';
import { WhatsappChannelConfigService } from '../../whatsapp-channel/services/whatsapp-channel-config.service';

@Injectable()
export class AiBrainVideoService {
  private static readonly analysisFallback =
    'El cliente envió un video, pero hubo un problema técnico analizándolo.';
  private static readonly maxFrameCount = 8;
  private static readonly minFrameCount = 4;
  private static readonly maxTranscriptChars = 4000;
  private readonly logger = new Logger(AiBrainVideoService.name);

  constructor(
    @InjectRepository(WhatsappMessageEntity)
    private readonly whatsappMessagesRepository: Repository<WhatsappMessageEntity>,
    private readonly storageService: StorageService,
    private readonly openAiService: OpenAiService,
    private readonly ffmpegRuntimeService: FfmpegRuntimeService,
    private readonly whatsappChannelConfigService: WhatsappChannelConfigService,
    private readonly evolutionApiClient: EvolutionApiClientService,
  ) {}

  async resolveInboundVideoText(params: {
    companyId: string;
    message: MessageEntity;
  }): Promise<{
    content: string;
    metadataPatch: Record<string, unknown>;
  }> {
    try {
      this.logger.log(
        `[AI VIDEO] VIDEO RECEIVED companyId=${params.companyId} messageId=${params.message.id}`,
      );

      const source = await this.resolveVideoSource(params.companyId, params.message);
      if (!source) {
        throw new Error('video_source_not_found');
      }

      this.logger.log(
        `[AI VIDEO] VIDEO DOWNLOADED companyId=${params.companyId} messageId=${params.message.id} file=${source.filename} bytes=${source.buffer.length} contentType=${source.contentType ?? '(none)'} duration=${source.durationSeconds ?? 0}`,
      );

      const artifacts = await this.extractVideoArtifacts({
        companyId: params.companyId,
        messageId: params.message.id,
        source,
      });

      if (artifacts.frames.length === 0 && !artifacts.transcriptText) {
        throw new Error('video_artifacts_empty');
      }

      this.logger.log(
        `[AI VIDEO] VIDEO ARTIFACTS companyId=${params.companyId} messageId=${params.message.id} frames=${artifacts.frames.length} transcriptChars=${artifacts.transcriptText?.length ?? 0}`,
      );

      const analysis = await this.openAiService.describeVideo({
        companyId: params.companyId,
        frames: artifacts.frames,
        transcriptText: artifacts.transcriptText,
      });
      const text = this.compactAnalysisText(analysis.text);
      if (!text) {
        throw new Error('empty_video_analysis');
      }

      const content = this.buildResolvedVideoContent(params.message.content, text);
      this.logger.log(
        `[AI VIDEO] ANALYSIS RESULT companyId=${params.companyId} messageId=${params.message.id} text="${text.slice(0, 200)}"`,
      );

      return {
        content,
        metadataPatch: {
          videoAnalysis: {
            status: 'completed',
            text,
            content,
            model: analysis.model,
            frames: artifacts.frames.length,
            transcript:
              artifacts.transcriptText?.slice(0, AiBrainVideoService.maxTranscriptChars) ?? null,
          },
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(
        `[AI VIDEO] analysis failed companyId=${params.companyId} messageId=${params.message.id} reason=${reason}`,
      );

      const content = this.buildResolvedVideoContent(
        params.message.content,
        AiBrainVideoService.analysisFallback,
      );
      return {
        content,
        metadataPatch: {
          videoAnalysis: {
            status: 'failed',
            error: reason,
            fallback: AiBrainVideoService.analysisFallback,
            content,
          },
        },
      };
    }
  }

  private async resolveVideoSource(
    companyId: string,
    message: MessageEntity,
  ): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string | null;
    durationSeconds: number | null;
  } | null> {
    const whatsappChannelMessageId =
      typeof message.metadata?.['whatsappChannelMessageId'] === 'string'
        ? String(message.metadata['whatsappChannelMessageId']).trim()
        : '';
    if (whatsappChannelMessageId) {
      const whatsappMessage = await this.whatsappMessagesRepository.findOne({
        where: { id: whatsappChannelMessageId, companyId },
      });
      if (whatsappMessage) {
        const resolvedWhatsappMessageVideo = await this.resolveWhatsappMessageVideoSource(
          companyId,
          message,
          whatsappMessage,
        );
        if (resolvedWhatsappMessageVideo) {
          return resolvedWhatsappMessageVideo;
        }
      }
    }

    const directMediaUrl = message.mediaUrl?.trim() ?? '';
    if (!directMediaUrl) {
      return null;
    }

    return this.resolveStoredAsset({
      companyId,
      candidate: directMediaUrl,
      filename: message.fileName ?? `${message.id}${this.extensionFromMimeType(message.mimeType)}`,
      mimeType: message.mimeType,
      durationSeconds: message.duration ?? null,
      sourceLabel: 'message_media_url',
    });
  }

  private async resolveWhatsappMessageVideoSource(
    companyId: string,
    message: MessageEntity,
    whatsappMessage: WhatsappMessageEntity,
  ): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string | null;
    durationSeconds: number | null;
  } | null> {
    const candidate = whatsappMessage.mediaStoragePath ?? whatsappMessage.mediaUrl;
    if (!candidate?.trim()) {
      return null;
    }

    const filename =
      whatsappMessage.mediaOriginalName?.trim() ||
      `${whatsappMessage.id}${this.extensionFromMimeType(whatsappMessage.mimeType)}`;

    return this.resolveStoredAsset({
      companyId,
      candidate,
      filename,
      channelConfigId: whatsappMessage.channelConfigId,
      mimeType: whatsappMessage.mimeType,
      durationSeconds: whatsappMessage.durationSeconds ?? message.duration ?? null,
      messagePayload: this.extractMessagePayload(whatsappMessage.rawPayloadJson),
      sourceLabel: 'whatsapp_message',
    });
  }

  private async resolveStoredAsset(params: {
    companyId: string;
    candidate: string | null;
    filename: string;
    channelConfigId?: string | null;
    mimeType?: string | null;
    durationSeconds?: number | null;
    messagePayload?: Record<string, unknown> | null;
    sourceLabel: string;
  }): Promise<{
    buffer: Buffer;
    filename: string;
    contentType: string | null;
    durationSeconds: number | null;
  } | null> {
    const trimmed = params.candidate?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith(`${params.companyId}/`)) {
      const stored = await this.storageService.getObjectBuffer({
        companyId: params.companyId,
        key: trimmed,
      });
      if (this.looksLikePlayableVideo(stored.buffer, stored.contentType ?? params.mimeType ?? null)) {
        return {
          buffer: stored.buffer,
          filename: params.filename,
          contentType: stored.contentType,
          durationSeconds: params.durationSeconds ?? null,
        };
      }

      this.logger.warn(
        `[AI VIDEO] invalid video payload source=${params.sourceLabel} mode=storage key=${trimmed} contentType=${stored.contentType ?? params.mimeType ?? '(none)'} bytes=${stored.buffer.length}`,
      );
    }

    if (params.channelConfigId) {
      const config = await this.whatsappChannelConfigService.getEntityById(
        params.companyId,
        params.channelConfigId,
      );
      const downloaded = await this.evolutionApiClient.downloadMediaUrl(config, trimmed);
      if (
        downloaded?.buffer.length &&
        this.looksLikePlayableVideo(downloaded.buffer, downloaded.contentType ?? params.mimeType ?? null)
      ) {
        return {
          buffer: downloaded.buffer,
          filename: params.filename,
          contentType: downloaded.contentType,
          durationSeconds: params.durationSeconds ?? null,
        };
      }

      if (downloaded?.buffer.length) {
        this.logger.warn(
          `[AI VIDEO] invalid video payload source=${params.sourceLabel} mode=media-url url=${trimmed} contentType=${downloaded.contentType ?? params.mimeType ?? '(none)'} bytes=${downloaded.buffer.length}`,
        );
      }

      if (params.messagePayload && Object.keys(params.messagePayload).length > 0) {
        const fallbackDownload = await this.evolutionApiClient.downloadMediaMessage(
          config,
          params.messagePayload,
        );
        if (
          fallbackDownload?.buffer.length &&
          this.looksLikePlayableVideo(
            fallbackDownload.buffer,
            fallbackDownload.contentType ?? params.mimeType ?? null,
          )
        ) {
          this.logger.log(
            `[AI VIDEO] resolved video via message payload source=${params.sourceLabel} contentType=${fallbackDownload.contentType ?? params.mimeType ?? '(none)'} bytes=${fallbackDownload.buffer.length}`,
          );
          return {
            buffer: fallbackDownload.buffer,
            filename: params.filename,
            contentType: fallbackDownload.contentType,
            durationSeconds: params.durationSeconds ?? null,
          };
        }

        if (fallbackDownload?.buffer.length) {
          this.logger.warn(
            `[AI VIDEO] invalid video payload source=${params.sourceLabel} mode=message-payload contentType=${fallbackDownload.contentType ?? params.mimeType ?? '(none)'} bytes=${fallbackDownload.buffer.length}`,
          );
        }
      }
    }

    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`video_download_failed_${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type');
    if (!this.looksLikePlayableVideo(buffer, contentType ?? params.mimeType ?? null)) {
      throw new Error(
        `video_download_invalid_payload_${contentType ?? params.mimeType ?? 'unknown'}`,
      );
    }

    return {
      buffer,
      filename: params.filename,
      contentType,
      durationSeconds: params.durationSeconds ?? null,
    };
  }

  private async extractVideoArtifacts(params: {
    companyId: string;
    messageId: string;
    source: {
      buffer: Buffer;
      filename: string;
      contentType: string | null;
      durationSeconds: number | null;
    };
  }): Promise<{
    frames: Array<{ buffer: Buffer; filename: string; contentType: string }>;
    transcriptText: string | null;
  }> {
    const ffmpegExecutable = await this.ffmpegRuntimeService.getExecutableOrThrow();
    const tempDir = await mkdtemp(join(tmpdir(), 'botposvendedor-video-analysis-'));
    const inputPath = join(
      tempDir,
      `input.${this.resolveInputExtension(params.source.filename, params.source.contentType)}`,
    );
    const framesDir = join(tempDir, 'frames');
    const audioPath = join(tempDir, 'audio.wav');

    try {
      await writeFile(inputPath, params.source.buffer);

      const durationSeconds =
        params.source.durationSeconds ??
        (await this.probeDurationSeconds(ffmpegExecutable, inputPath)) ??
        0;
      const frameCount = this.resolveFrameCount(durationSeconds);
      const timestamps = this.buildFrameTimestamps(durationSeconds, frameCount);
      const frames: Array<{ buffer: Buffer; filename: string; contentType: string }> = [];

      await this.ensureDirectory(framesDir);

      for (let index = 0; index < timestamps.length; index += 1) {
        const timestamp = timestamps[index];
        const outputPath = join(framesDir, `frame-${index + 1}.jpg`);
        const extracted = await this.extractFrame(
          ffmpegExecutable,
          inputPath,
          outputPath,
          timestamp,
        );
        if (!extracted) {
          continue;
        }

        frames.push({
          buffer: await readFile(outputPath),
          filename: `frame-${index + 1}.jpg`,
          contentType: 'image/jpeg',
        });
      }

      let transcriptText: string | null = null;
      const extractedAudio = await this.extractAudioTrack(ffmpegExecutable, inputPath, audioPath);
      if (extractedAudio && existsSync(audioPath)) {
        const transcript = await this.openAiService.transcribeAudio({
          companyId: params.companyId,
          buffer: await readFile(audioPath),
          filename: 'video-audio.wav',
          contentType: 'audio/wav',
          model: 'gpt-4o-mini-transcribe',
          timeoutMs: 90000,
        });
        const text = transcript.text.trim();
        transcriptText = text ? text.slice(0, AiBrainVideoService.maxTranscriptChars) : null;
      }

      return { frames, transcriptText };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async probeDurationSeconds(
    ffmpegExecutable: string,
    inputPath: string,
  ): Promise<number | null> {
    try {
      const stderr = await new Promise<string>((resolve, reject) => {
        let collected = '';
        const child = spawn(ffmpegExecutable, ['-i', inputPath], {
          windowsHide: true,
          stdio: ['ignore', 'ignore', 'pipe'],
        });

        child.stderr?.on('data', (chunk: Buffer | string) => {
          collected += chunk.toString();
        });
        child.on('error', reject);
        child.on('close', () => resolve(collected));
      });

      return this.parseDurationSeconds(stderr);
    } catch {
      return null;
    }
  }

  private async extractFrame(
    ffmpegExecutable: string,
    inputPath: string,
    outputPath: string,
    timestampSeconds: number,
  ): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        let stderr = '';
        const child = spawn(
          ffmpegExecutable,
          [
            '-y',
            '-ss',
            timestampSeconds.toFixed(2),
            '-i',
            inputPath,
            '-frames:v',
            '1',
            '-q:v',
            '2',
            outputPath,
          ],
          { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
        );

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

      return existsSync(outputPath);
    } catch {
      return false;
    }
  }

  private async extractAudioTrack(
    ffmpegExecutable: string,
    inputPath: string,
    outputPath: string,
  ): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        let stderr = '';
        const child = spawn(
          ffmpegExecutable,
          [
            '-y',
            '-i',
            inputPath,
            '-vn',
            '-acodec',
            'pcm_s16le',
            '-ar',
            '16000',
            '-ac',
            '1',
            outputPath,
          ],
          { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
        );

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

      return existsSync(outputPath);
    } catch {
      return false;
    }
  }

  private async ensureDirectory(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
  }

  private resolveFrameCount(durationSeconds: number): number {
    if (!durationSeconds || durationSeconds <= 0) {
      return AiBrainVideoService.minFrameCount;
    }

    return Math.max(
      AiBrainVideoService.minFrameCount,
      Math.min(AiBrainVideoService.maxFrameCount, Math.ceil(durationSeconds / 8)),
    );
  }

  private buildFrameTimestamps(durationSeconds: number, frameCount: number): number[] {
    if (!durationSeconds || durationSeconds <= 0 || frameCount <= 1) {
      return [0, 1, 2, 3].slice(0, frameCount);
    }

    const safeEnd = Math.max(durationSeconds - 0.5, 0);
    const timestamps: number[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      const ratio = frameCount === 1 ? 0 : index / (frameCount - 1);
      timestamps.push(Number((safeEnd * ratio).toFixed(2)));
    }
    return Array.from(new Set(timestamps));
  }

  private parseDurationSeconds(stderr: string): number | null {
    const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
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

  private buildResolvedVideoContent(originalContent: string, analysis: string): string {
    const compactAnalysis = this.compactAnalysisText(analysis);
    const normalizedOriginal = originalContent.trim();
    if (normalizedOriginal && !this.isGenericVideoPlaceholder(normalizedOriginal)) {
      return `Contexto del cliente: envio un video con este texto adjunto: "${normalizedOriginal}". Resumen del video: ${compactAnalysis}`;
    }

    return `Contexto del cliente: envio un video. Resumen del video: ${compactAnalysis}`;
  }

  private compactAnalysisText(analysis: string): string {
    return analysis
      .replace(/#{1,6}\s*/g, '')
      .replace(/\*\*/g, '')
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/\r/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0)
      .slice(0, 4)
      .join(' ');
  }

  private isGenericVideoPlaceholder(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    return normalized === 'video recibido' || normalized === 'vídeo recibido';
  }

  private resolveInputExtension(filename: string, contentType: string | null): string {
    const fromName = extname(filename).replace('.', '').trim().toLowerCase();
    if (fromName) {
      return fromName;
    }

    switch ((contentType ?? '').toLowerCase()) {
      case 'video/webm':
        return 'webm';
      case 'video/quicktime':
        return 'mov';
      case 'video/x-matroska':
        return 'mkv';
      case 'video/mp4':
      default:
        return 'mp4';
    }
  }

  private extensionFromMimeType(mimeType: string | null): string {
    switch ((mimeType ?? '').toLowerCase()) {
      case 'video/webm':
        return '.webm';
      case 'video/quicktime':
        return '.mov';
      case 'video/x-matroska':
        return '.mkv';
      default:
        return '.mp4';
    }
  }

  private extractMessagePayload(rawPayload: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
    const directMessage = this.readMap(rawPayload?.['message']);
    if (Object.keys(directMessage).length > 0) {
      return directMessage;
    }

    const data = this.readMap(rawPayload?.['data']);
    const dataMessage = this.readMap(data['message']);
    if (Object.keys(dataMessage).length > 0) {
      return dataMessage;
    }

    const messages = Array.isArray(data['messages']) ? data['messages'] : [];
    for (const entry of messages) {
      const resolvedMessage = this.readMap(this.readMap(entry)['message']);
      if (Object.keys(resolvedMessage).length > 0) {
        return resolvedMessage;
      }
    }

    return null;
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

  private looksLikeStructuredTextPayload(buffer: Buffer, mimeType: string | null): boolean {
    const normalizedMimeType = mimeType?.toLowerCase() ?? '';
    if (normalizedMimeType.includes('json') || normalizedMimeType.startsWith('text/')) {
      return true;
    }

    const preview = buffer
      .subarray(0, Math.min(buffer.length, 120))
      .toString('utf8')
      .trim();

    if (!preview) {
      return false;
    }

    return (
      preview.startsWith('{') ||
      preview.startsWith('[') ||
      preview.startsWith('<?xml') ||
      preview.startsWith('<html') ||
      preview.startsWith('data:')
    );
  }

  private readMap(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
