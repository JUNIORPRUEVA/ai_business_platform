import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { Repository } from 'typeorm';

import { MessageEntity } from '../../messages/entities/message.entity';
import { OpenAiService } from '../../openai/services/openai.service';
import { StorageService } from '../../storage/storage.service';
import { WhatsappMessageEntity } from '../../whatsapp-channel/entities/whatsapp-message.entity';
import { FfmpegRuntimeService } from '../../whatsapp-channel/services/ffmpeg-runtime.service';

@Injectable()
export class AiBrainAudioService {
  private static readonly transcriptionFallback = 'El usuario envió un audio sin transcripción clara';
  private readonly logger = new Logger(AiBrainAudioService.name);

  constructor(
    @InjectRepository(WhatsappMessageEntity)
    private readonly whatsappMessagesRepository: Repository<WhatsappMessageEntity>,
    private readonly storageService: StorageService,
    private readonly openAiService: OpenAiService,
    private readonly ffmpegRuntimeService: FfmpegRuntimeService,
  ) {}

  async resolveInboundAudioText(params: {
    companyId: string;
    message: MessageEntity;
  }): Promise<{
    content: string;
    metadataPatch: Record<string, unknown>;
  }> {
    try {
      this.logger.log(
        `[AI AUDIO] audio received companyId=${params.companyId} messageId=${params.message.id}`,
      );
      const source = await this.resolveAudioSource(params.companyId, params.message);
      if (!source) {
        throw new Error('audio_source_not_found');
      }

      const converted = await this.convertAudioToWav(source);
      this.logger.log(
        `[AI AUDIO] audio converted companyId=${params.companyId} messageId=${params.message.id} file=${converted.filename} bytes=${converted.buffer.length}`,
      );
      const transcript = await this.openAiService.transcribeAudio({
        companyId: params.companyId,
        buffer: converted.buffer,
        filename: converted.filename,
        contentType: 'audio/wav',
        model: 'gpt-4o-mini-transcribe',
      });
      const text = transcript.text.trim();
      if (!text) {
        throw new Error('empty_transcript');
      }
      this.logger.log(
        `[AI AUDIO] transcription success companyId=${params.companyId} messageId=${params.message.id} text="${text.slice(0, 160)}"`,
      );

      return {
        content: text,
        metadataPatch: {
          audioTranscription: {
            status: 'completed',
            text,
            model: transcript.model,
          },
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error';
      this.logger.warn(
        `[AI AUDIO] transcription failed companyId=${params.companyId} messageId=${params.message.id} reason=${reason}`,
      );
      return {
        content: AiBrainAudioService.transcriptionFallback,
        metadataPatch: {
          audioTranscription: {
            status: 'failed',
            error: reason,
            fallback: AiBrainAudioService.transcriptionFallback,
          },
        },
      };
    }
  }

  private async resolveAudioSource(
    companyId: string,
    message: MessageEntity,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string | null } | null> {
    if (message.mediaUrl?.trim()) {
      return this.resolveStoredAsset(
        companyId,
        message.mediaUrl,
        message.fileName ?? `${message.id}${this.extensionFromMimeType(message.mimeType)}`,
      );
    }

    const whatsappChannelMessageId =
      typeof message.metadata?.['whatsappChannelMessageId'] === 'string'
        ? String(message.metadata['whatsappChannelMessageId']).trim()
        : '';
    if (!whatsappChannelMessageId) {
      return null;
    }

    const whatsappMessage = await this.whatsappMessagesRepository.findOne({
      where: { id: whatsappChannelMessageId, companyId },
    });
    if (!whatsappMessage) {
      return null;
    }

    const filename =
      whatsappMessage.mediaOriginalName?.trim() ||
      `${whatsappMessage.id}${this.extensionFromMimeType(whatsappMessage.mimeType)}`;
    const stored = await this.resolveStoredAsset(
      companyId,
      whatsappMessage.mediaStoragePath ?? whatsappMessage.mediaUrl,
      filename,
    );
    if (!stored) {
      return null;
    }

    return {
      buffer: stored.buffer,
      filename,
      contentType: stored.contentType ?? whatsappMessage.mimeType ?? null,
    };
  }

  private async resolveStoredAsset(
    companyId: string,
    candidate: string | null,
    filename: string,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string | null } | null> {
    const trimmed = candidate?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith(`${companyId}/`)) {
      const stored = await this.storageService.getObjectBuffer({ companyId, key: trimmed });
      return {
        buffer: stored.buffer,
        filename,
        contentType: stored.contentType,
      };
    }

    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`audio_download_failed_${response.status}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      filename,
      contentType: response.headers.get('content-type'),
    };
  }

  private async convertAudioToWav(source: {
    buffer: Buffer;
    filename: string;
    contentType: string | null;
  }): Promise<{ buffer: Buffer; filename: string }> {
    const executable = await this.ffmpegRuntimeService.getExecutableOrThrow();
    const tempDir = await mkdtemp(join(tmpdir(), 'botposvendedor-audio-transcribe-'));
    const inputPath = join(
      tempDir,
      `input.${this.resolveInputExtension(source.filename, source.contentType)}`,
    );
    const outputPath = join(tempDir, 'output.wav');

    try {
      await writeFile(inputPath, source.buffer);

      await new Promise<void>((resolve, reject) => {
        let stderr = '';
        const child = spawn(
          executable,
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
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(new Error(`ffmpeg_conversion_failed_${code ?? 'unknown'}:${stderr}`));
        });
      });

      return {
        buffer: await readFile(outputPath),
        filename: 'output.wav',
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private resolveInputExtension(filename: string, contentType: string | null): string {
    const named = extname(filename).replace('.', '').trim().toLowerCase();
    if (named) {
      return named;
    }

    switch ((contentType ?? '').toLowerCase()) {
      case 'audio/mpeg':
      case 'audio/mp3':
        return 'mp3';
      case 'audio/mp4':
      case 'audio/m4a':
      case 'audio/aac':
        return 'm4a';
      case 'audio/wav':
      case 'audio/x-wav':
        return 'wav';
      default:
        return 'ogg';
    }
  }

  private extensionFromMimeType(mimeType: string | null): string {
    switch ((mimeType ?? '').toLowerCase()) {
      case 'audio/mpeg':
      case 'audio/mp3':
        return '.mp3';
      case 'audio/mp4':
      case 'audio/m4a':
      case 'audio/aac':
        return '.m4a';
      case 'audio/wav':
      case 'audio/x-wav':
        return '.wav';
      default:
        return '.ogg';
    }
  }
}
