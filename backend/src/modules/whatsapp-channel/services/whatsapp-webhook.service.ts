import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { WhatsappMessageType } from '../entities/whatsapp-message.entity';
import { WhatsappAttachmentService } from './whatsapp-attachment.service';
import { WhatsappChannelConfigService } from './whatsapp-channel-config.service';
import { WhatsappChannelLogService } from './whatsapp-channel-log.service';
import { WhatsappMessagingService } from './whatsapp-messaging.service';

export interface WhatsappWebhookJob {
  companyId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class WhatsappWebhookService {
  constructor(
    @InjectQueue('whatsapp-webhook-processing')
    private readonly webhookQueue: Queue<WhatsappWebhookJob>,
    @InjectRepository(WhatsappChannelConfigEntity)
    private readonly configsRepository: Repository<WhatsappChannelConfigEntity>,
    private readonly configService: WhatsappChannelConfigService,
    private readonly logsService: WhatsappChannelLogService,
    private readonly messagingService: WhatsappMessagingService,
    private readonly attachmentsService: WhatsappAttachmentService,
  ) {}

  async enqueue(companyId: string, payload: Record<string, unknown>): Promise<{ queued: true }> {
    const config = await this.configService.getEntity(companyId);
    await this.logsService.create({
      companyId,
      instanceName: config.instanceName,
      direction: 'incoming_webhook',
      eventName: this.normalizeEventName(payload['event']),
      requestPayloadJson: payload,
      responsePayloadJson: {},
      httpStatus: 200,
      success: true,
      errorMessage: null,
    });

    await this.webhookQueue.add(
      'process-evolution-webhook',
      { companyId, payload },
      { removeOnComplete: 1000, removeOnFail: 1000 },
    );
    return { queued: true };
  }

  async processJob(job: WhatsappWebhookJob): Promise<void> {
    const config = await this.configsRepository.findOne({
      where: { companyId: job.companyId, provider: 'evolution' },
    });
    if (!config) {
      return;
    }

    const eventName = this.normalizeEventName(job.payload['event']);
    switch (eventName) {
      case 'CONNECTION_UPDATE':
        await this.handleConnectionUpdate(config, job.payload);
        break;
      case 'QRCODE_UPDATED':
        config.instanceStatus = 'connecting';
        config.lastSyncAt = new Date();
        await this.configsRepository.save(config);
        break;
      case 'MESSAGES_UPDATE':
        await this.handleMessageStatusUpdate(job.companyId, job.payload);
        break;
      case 'MESSAGES_DELETE':
        await this.handleMessageDelete(job.companyId, job.payload);
        break;
      case 'MESSAGES_UPSERT':
      case 'SEND_MESSAGE':
      default:
        await this.handleMessageUpsert(config, job.payload);
        break;
    }
  }

  private async handleConnectionUpdate(
    config: WhatsappChannelConfigEntity,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const data = this.readMap(payload['data']);
    const state = this.readString(data['state']) || this.readString(data['status']);
    config.instanceStatus = state || config.instanceStatus;
    config.lastSyncAt = new Date();
    await this.configsRepository.save(config);
  }

  private async handleMessageStatusUpdate(
    companyId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const data = this.readMap(payload['data']);
    const key = this.readMap(data['key']);
    const messageId = this.readString(key['id']);
    if (!messageId) {
      return;
    }

    const status = this.readString(data['status']) || this.readString(payload['status']) || 'updated';
    const message = await this.messagingService.upsertInboundMessage({
      companyId,
      config: await this.configService.getEntity(companyId),
      remoteJid: this.normalizeRemoteJid(this.readString(key['remoteJid'])),
      pushName: null,
      evolutionMessageId: messageId,
      fromMe: this.readBoolean(key['fromMe']),
      messageType: 'unknown',
      textBody: null,
      caption: null,
      mimeType: null,
      mediaUrl: null,
      mediaOriginalName: null,
      thumbnailUrl: null,
      rawPayloadJson: payload,
      status,
    });
    void message;
  }

  private async handleMessageDelete(companyId: string, payload: Record<string, unknown>): Promise<void> {
    await this.handleMessageStatusUpdate(companyId, {
      ...payload,
      data: {
        ...this.readMap(payload['data']),
        status: 'deleted',
      },
    });
  }

  private async handleMessageUpsert(
    config: WhatsappChannelConfigEntity,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const data = this.readMap(payload['data']);
    const key = this.readMap(data['key']);
    const remoteJid = this.normalizeRemoteJid(this.readString(key['remoteJid']));
    const messageId = this.readString(key['id']) || null;
    const fromMe = this.readBoolean(key['fromMe']);
    const message = this.readMap(data['message']);
    const type = this.detectType(message);
    const content = this.extractContent(type, message);

    const saved = await this.messagingService.upsertInboundMessage({
      companyId: config.companyId,
      config,
      remoteJid,
      pushName: this.readString(data['pushName']) || null,
      evolutionMessageId: messageId,
      fromMe,
      messageType: type,
      textBody: content.textBody,
      caption: content.caption,
      mimeType: content.mimeType,
      mediaUrl: content.mediaUrl,
      mediaOriginalName: content.mediaOriginalName,
      thumbnailUrl: content.thumbnailUrl,
      rawPayloadJson: payload,
      status: fromMe ? 'sent' : 'received',
    });

    if (content.mediaUrl) {
      const attachment = await this.attachmentsService.downloadRemoteToStorage({
        companyId: config.companyId,
        messageId: saved.id,
        fileType: type,
        mimeType: content.mimeType,
        originalName: content.mediaOriginalName ?? `${type}-${saved.id}`,
        sourceUrl: content.mediaUrl,
        metadataJson: { thumbnailUrl: content.thumbnailUrl },
      });

      if (attachment) {
        await this.messagingService.updateStoredMedia(config.companyId, saved.id, {
          mediaStoragePath: attachment.storagePath,
          mediaSizeBytes: attachment.sizeBytes,
        });
      }
    }
  }

  private detectType(message: Record<string, unknown>): WhatsappMessageType {
    if (message['conversation'] != null || message['extendedTextMessage'] != null) return 'text';
    if (message['imageMessage'] != null) return 'image';
    if (message['videoMessage'] != null) return 'video';
    if (message['audioMessage'] != null) return 'audio';
    if (message['documentMessage'] != null) return 'document';
    return 'unknown';
  }

  private extractContent(
    type: WhatsappMessageType,
    message: Record<string, unknown>,
  ): {
    textBody: string | null;
    caption: string | null;
    mimeType: string | null;
    mediaUrl: string | null;
    mediaOriginalName: string | null;
    thumbnailUrl: string | null;
  } {
    if (type === 'text') {
      const extended = this.readMap(message['extendedTextMessage']);
      return {
        textBody: this.readString(message['conversation']) || this.readString(extended['text']) || 'Mensaje recibido',
        caption: null,
        mimeType: null,
        mediaUrl: null,
        mediaOriginalName: null,
        thumbnailUrl: null,
      };
    }

    const media =
      type === 'image'
        ? this.readMap(message['imageMessage'])
        : type === 'video'
            ? this.readMap(message['videoMessage'])
            : type === 'audio'
                ? this.readMap(message['audioMessage'])
                : this.readMap(message['documentMessage']);

    return {
      textBody: type === 'audio' ? 'Audio recibido' : this.readString(media['caption']) || `${type} recibido`,
      caption: this.readString(media['caption']) || null,
      mimeType: this.readString(media['mimetype']) || null,
      mediaUrl: this.readString(media['url']) || null,
      mediaOriginalName: this.readString(media['fileName']) || null,
      thumbnailUrl: this.readString(media['jpegThumbnail']) || null,
    };
  }

  private normalizeEventName(value: unknown): string {
    const raw = this.readString(value);
    if (!raw) {
      return 'UNKNOWN_EVENT';
    }
    return raw.replace(/\./g, '_').replace(/-/g, '_').toUpperCase();
  }

  private normalizeRemoteJid(value: string): string {
    if (!value) {
      return '';
    }
    return value.includes('@') ? value : `${value.replace(/\D/g, '')}@s.whatsapp.net`;
  }

  private readMap(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readBoolean(value: unknown): boolean {
    return value === true;
  }
}