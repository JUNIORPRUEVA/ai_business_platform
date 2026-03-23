import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
export class AiBrainAudioService {
  private static readonly transcriptionFallback =
    'Recib\u00ed tu audio, pero hubo un problema t\u00e9cnico proces\u00e1ndolo.';
  private readonly logger = new Logger(AiBrainAudioService.name);

  constructor(
    @InjectRepository(WhatsappMessageEntity)
    private readonly whatsappMessagesRepository: Repository<WhatsappMessageEntity>,
    private readonly storageService: StorageService,
    private readonly openAiService: OpenAiService,
    private readonly ffmpegRuntimeService: FfmpegRuntimeService,
    private readonly whatsappChannelConfigService: WhatsappChannelConfigService,
    private readonly evolutionApiClient: EvolutionApiClientService,
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
        `[AI AUDIO] AUDIO RECEIVED companyId=${params.companyId} messageId=${params.message.id}`,
      );
      const source = await this.resolveAudioSource(params.companyId, params.message);
      if (!source) {
        throw new Error('audio_source_not_found');
      }

      this.logger.log(
        `[AI AUDIO] AUDIO DOWNLOADED companyId=${params.companyId} messageId=${params.message.id} file=${source.filename} bytes=${source.buffer.length} contentType=${source.contentType ?? '(none)'}`,
      );

      const converted = await this.convertAudioToWav(source, params.companyId, params.message.id);
      this.logger.log(
        `[AI AUDIO] AUDIO CONVERTED companyId=${params.companyId} messageId=${params.message.id} file=${converted.filename} bytes=${converted.buffer.length}`,
      );
      this.logger.log(
        `[AI AUDIO] TRANSCRIPTION START companyId=${params.companyId} messageId=${params.message.id} file=${converted.filename}`,
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
        `[AI AUDIO] TRANSCRIPTION RESULT: ${text.slice(0, 160)}`,
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
    const directMediaUrl = message.mediaUrl?.trim() ?? '';
    if (!directMediaUrl) {
      this.logger.error(
        `[AI AUDIO] AUDIO WITHOUT MEDIA URL - INVALID FLOW companyId=${companyId} messageId=${message.id}`,
      );
    }

    if (directMediaUrl) {
      return this.resolveStoredAsset({
        companyId,
        candidate: directMediaUrl,
        filename: message.fileName ?? `${message.id}${this.extensionFromMimeType(message.mimeType)}`,
      });
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

    const candidate = whatsappMessage.mediaStoragePath ?? whatsappMessage.mediaUrl;
    if (!candidate?.trim()) {
      this.logger.error(
        `[AI AUDIO] AUDIO WITHOUT MEDIA URL - INVALID FLOW companyId=${companyId} messageId=${message.id} whatsappMessageId=${whatsappMessage.id}`,
      );
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
    });
  }

  private async resolveStoredAsset(params: {
    companyId: string;
    candidate: string | null;
    filename: string;
    channelConfigId?: string | null;
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
        contentType: stored.contentType,
      };
    }

    if (params.channelConfigId) {
      const config = await this.whatsappChannelConfigService.getEntityById(
        params.companyId,
        params.channelConfigId,
      );
      const downloaded = await this.evolutionApiClient.downloadMediaUrl(config, trimmed);
      if (downloaded?.buffer.length) {
        return {
          buffer: downloaded.buffer,
          filename: params.filename,
          contentType: downloaded.contentType,
        };
      }
    }

    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`audio_download_failed_${response.status}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      filename: params.filename,
      contentType: response.headers.get('content-type'),
    };
  }

  private async convertAudioToWav(
    source: {
      buffer: Buffer;
      filename: string;
      contentType: string | null;
    },
    companyId: string,
    messageId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const executable = await this.ffmpegRuntimeService.getExecutableOrThrow();
    const tempDir = await mkdtemp(join(tmpdir(), 'botposvendedor-audio-transcribe-'));
    const inputPath = join(
      tempDir,
      `input.${this.resolveInputExtension(source.filename, source.contentType)}`,
    );
    const outputPath = join(tempDir, 'output.wav');

    try {
      await writeFile(inputPath, source.buffer);
      this.logger.log(
        `[AI AUDIO] AUDIO FILE PATH: ${inputPath} companyId=${companyId} messageId=${messageId}`,
      );
      if (!existsSync(inputPath)) {
        throw new Error('AUDIO FILE NOT FOUND - DOWNLOAD FAILED');
      }

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

      if (!existsSync(outputPath)) {
        throw new Error('AUDIO FILE NOT FOUND - DOWNLOAD FAILED');
      }

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
