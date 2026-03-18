import { Injectable, Logger } from '@nestjs/common';
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

export interface WhatsappWebhookProcessResult {
  processed: true;
  configId: string | null;
  savedMessages: Array<{
    messageId: string;
    chatId: string;
    remoteJid: string;
    messageType: WhatsappMessageType;
    fromMe: boolean;
  }>;
}

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

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
    await this.recordIncomingWebhook(companyId, config.instanceName, payload);

    await this.webhookQueue.add(
      'process-evolution-webhook',
      { companyId, payload },
      { removeOnComplete: 1000, removeOnFail: 1000 },
    );
    return { queued: true };
  }

  async processNow(companyId: string, payload: Record<string, unknown>): Promise<WhatsappWebhookProcessResult> {
    const config = await this.resolveConfig(companyId, payload);
    if (!config) {
      this.logger.warn(
        `[EVOLUTION INBOUND] persistence skipped companyId=${companyId} reason=missing_config`,
      );
      return { processed: true, configId: null, savedMessages: [] };
    }

    await this.recordIncomingWebhook(companyId, config.instanceName, payload);
    return this.processJob({ companyId, payload });
  }

  async processJob(job: WhatsappWebhookJob): Promise<WhatsappWebhookProcessResult> {
    const config = await this.resolveConfig(job.companyId, job.payload);
    if (!config) {
      this.logger.warn('[EVOLUTION INBOUND] whatsapp config resolution failed reason=missing_config');
      return { processed: true, configId: null, savedMessages: [] };
    }

    const eventName = this.normalizeEventName(job.payload['event']);
    const canonicalPayloads = this.expandPayload(job.payload);
    const savedMessages: WhatsappWebhookProcessResult['savedMessages'] = [];

    this.logger.log(
      `[EVOLUTION INBOUND] normalized event=${eventName} accepted=${eventName !== 'UNKNOWN_EVENT'} entries=${canonicalPayloads.length}`,
    );

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
        for (const payload of canonicalPayloads) {
          const result = await this.handleMessageUpsert(config, payload);
          if (result) {
            savedMessages.push(result);
          }
        }
        break;
    }

    return {
      processed: true,
      configId: config.id,
      savedMessages,
    };
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
      this.logger.warn('[EVOLUTION INBOUND] status update ignored reason=missing_message_id');
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
    this.logger.log(
      `[EVOLUTION INBOUND] message status saved id=${message.id} chatId=${message.chatId} companyId=${companyId} remoteJid=${message.remoteJid} status=${status}`,
    );
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
  ): Promise<WhatsappWebhookProcessResult['savedMessages'][number] | null> {
    const data = this.readMap(payload['data']);
    const key = this.readMap(data['key']);
    const remoteJid = this.normalizeRemoteJid(this.readString(key['remoteJid']));
    if (!remoteJid) {
      this.logger.warn('[EVOLUTION INBOUND] message ignored reason=missing_remote_jid');
      return null;
    }

    const messageId = this.readString(key['id']) || null;
    const fromMe = this.readBoolean(key['fromMe']);
    const message = this.readMap(data['message']);
    const type = this.detectType(message);
    const content = this.extractContent(type, message);

    const canonicalRemoteJid = this.extractCanonicalRemoteJid(data, key, message);

    this.logger.log(
      `[EVOLUTION INBOUND] instance=${config.instanceName} companyId=${config.companyId} remoteJid=${remoteJid} messageId=${messageId ?? '(none)'} type=${type} accepted=${type !== 'unknown' || content.textBody != null}`,
    );

    const saved = await this.messagingService.upsertInboundMessage({
      companyId: config.companyId,
      config,
      remoteJid,
      canonicalRemoteJid,
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

    this.logger.log(
      `[EVOLUTION INBOUND] chat resolved id=${saved.chatId} companyId=${config.companyId} remoteJid=${remoteJid}`,
    );
    this.logger.log(
      `[EVOLUTION INBOUND] message saved id=${saved.id} type=${saved.messageType} companyId=${config.companyId} remoteJid=${remoteJid}`,
    );

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

    return {
      messageId: saved.id,
      chatId: saved.chatId,
      remoteJid: saved.remoteJid,
      messageType: saved.messageType,
      fromMe: saved.fromMe,
    };
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

  private extractCanonicalRemoteJid(
    data: Record<string, unknown>,
    key: Record<string, unknown>,
    message: Record<string, unknown>,
  ): string | null {
    const candidates = [
      this.readString(key['participant']),
      this.readString(data['participant']),
      this.readString(data['sender']),
    ].filter((v) => v);

    for (const candidate of candidates) {
      if (candidate.endsWith('@s.whatsapp.net')) {
        return candidate;
      }
    }

    const extended = this.readMap(message['extendedTextMessage']);
    const contextInfo = this.readMap(extended['contextInfo'] ?? message['contextInfo']);
    const participant = this.readString(contextInfo['participant']);
    if (participant.endsWith('@s.whatsapp.net')) {
      return participant;
    }

    return null;
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

  private async resolveConfig(
    companyId: string,
    payload: Record<string, unknown>,
  ): Promise<WhatsappChannelConfigEntity | null> {
    const instanceName = this.readInstanceName(payload);
    if (instanceName) {
      const exact = await this.configsRepository.findOne({
        where: { companyId, provider: 'evolution', instanceName },
      });
      if (exact) {
        return exact;
      }
    }

    return this.configsRepository.findOne({
      where: { companyId, provider: 'evolution' },
    });
  }

  private expandPayload(payload: Record<string, unknown>): Record<string, unknown>[] {
    const data = this.readMap(payload['data']);
    const messages = data['messages'];
    if (!Array.isArray(messages) || messages.length === 0) {
      return [payload];
    }

    const sharedData = { ...data };
    delete sharedData['messages'];

    return messages
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        ...payload,
        instance:
          payload['instance'] ??
          payload['instanceName'] ??
          data['instance'] ??
          data['instanceName'] ??
          data['instance_name'] ??
          item['instance'] ??
          item['instanceName'],
        data: {
          ...sharedData,
          ...item,
          key: this.readMap(item['key']),
          message: this.readMap(item['message']),
        },
      }));
  }

  private readInstanceName(payload: Record<string, unknown>): string {
    const data = this.readMap(payload['data']);
    return this.readString(payload['instance']) ||
      this.readString(payload['instanceName']) ||
      this.readString(data['instance']) ||
      this.readString(data['instanceName']) ||
      this.readString(data['instance_name']);
  }

  private async recordIncomingWebhook(
    companyId: string,
    instanceName: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.logsService.create({
      companyId,
      instanceName,
      direction: 'incoming_webhook',
      eventName: this.normalizeEventName(payload['event']),
      endpointCalled: '/webhook/evolution',
      requestPayloadJson: payload,
      responsePayloadJson: {},
      httpStatus: 200,
      success: true,
      errorMessage: null,
    });
  }
}