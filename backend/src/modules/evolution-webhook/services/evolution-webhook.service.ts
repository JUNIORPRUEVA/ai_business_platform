import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { EvolutionMessageWebhookDto } from '../dto/evolution-message-webhook.dto';
import {
  EvolutionWebhookProcessResponse,
  NormalizedEvolutionMessage,
} from '../types/evolution-webhook.types';

import { MemoryCacheService } from '../../ai-engine/memory-cache.service';
import { MemoryDeduplicationService } from '../../ai-engine/memory-deduplication.service';
import { BotConfigurationEntity } from '../../bot-configuration/entities/bot-configuration.entity';
import { ChannelsService } from '../../channels/channels.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessageType } from '../../messages/entities/message.entity';
import { MessagesService } from '../../messages/messages.service';
import { MessageProcessingJob } from '../../workers/processors/message-processing.processor';

@Injectable()
export class EvolutionWebhookService {
  private static readonly configurationScope = 'default';

  constructor(
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly memoryCacheService: MemoryCacheService,
    private readonly memoryDeduplicationService: MemoryDeduplicationService,
    @InjectQueue('message-processing')
    private readonly messageProcessingQueue: Queue<MessageProcessingJob>,
    @InjectRepository(BotConfigurationEntity)
    private readonly botConfigurationRepository: Repository<BotConfigurationEntity>,
  ) {}

  async processIncomingMessage(params: {
    channelId: string;
    webhookToken?: string;
    payload: EvolutionMessageWebhookDto;
  }): Promise<EvolutionWebhookProcessResponse> {
    const normalized = this.normalizePayload(params.payload);
    const whatsappSettings = await this.getWhatsappSettings();
    const channel = await this.channelsService.getByIdUnsafe(params.channelId);

    if (channel.type !== 'whatsapp') {
      throw new BadRequestException('Channel is not a WhatsApp channel.');
    }

    const configuredToken =
      typeof channel.config['webhookToken'] === 'string'
        ? (channel.config['webhookToken'] as string)
        : '';
    if (configuredToken && params.webhookToken !== configuredToken) {
      throw new ForbiddenException('Invalid webhook token.');
    }

    if (!this.isInboundTypeAllowed(normalized.type, whatsappSettings)) {
      return {
        normalizedMessage: normalized,
        orchestration: {
          queued: false,
          reason: `El tipo ${normalized.type} esta deshabilitado en la configuracion de WhatsApp.`,
        },
      };
    }

    const companyId = channel.companyId;
    const contactPhone = normalized.senderId;
    const eventKey = this.memoryDeduplicationService.buildEventKey({
      channel: normalized.channel,
      senderId: normalized.senderId,
      externalMessageId:
        typeof normalized.metadata?.['externalMessageId'] === 'string'
          ? (normalized.metadata['externalMessageId'] as string)
          : null,
      timestamp: normalized.timestamp ?? null,
      type: normalized.type,
      content: normalized.message,
    });

    if (whatsappSettings.deduplicationEnabled) {
      const acquired = await this.memoryCacheService.acquireIdempotency(
        this.memoryCacheService.idempotencyKey(companyId, 'webhook', eventKey),
        300,
      );

      if (!acquired) {
        return {
          normalizedMessage: normalized,
          orchestration: {
            queued: false,
            reason: 'Duplicate webhook event ignored by Redis idempotency.',
          },
        };
      }
    }

    const contact = await this.contactsService.findOrCreateByPhone(
      companyId,
      contactPhone,
      normalized.senderName ?? null,
    );

    const conversation = await this.conversationsService.findOrCreateOpen(
      companyId,
      channel.id,
      contact.id,
    );

    if (whatsappSettings.deduplicationEnabled) {
      const duplicateMessage = await this.messagesService.findByMetadataValue(
        companyId,
        conversation.id,
        'eventKey',
        eventKey,
      );

      if (duplicateMessage) {
        return {
          normalizedMessage: normalized,
          orchestration: {
            queued: false,
            reason: `Duplicate webhook event ignored; message ${duplicateMessage.id} already exists.`,
          },
        };
      }
    }

    const message = await this.messagesService.create(companyId, conversation.id, {
      sender: 'client',
      content: normalized.message,
      type: normalized.type,
      metadata: this.buildStoredMetadata(normalized, whatsappSettings.persistMediaMetadata, eventKey),
    });

    await this.messageProcessingQueue.add(
      'process-inbound-message',
      {
        companyId,
        channelId: channel.id,
        contactPhone,
        conversationId: conversation.id,
        messageId: message.id,
      },
      {
        jobId: `process-inbound-message:${eventKey}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    return {
      normalizedMessage: normalized,
      orchestration: {
        queued: true,
        conversationId: conversation.id,
        messageId: message.id,
      },
    };
  }

  private normalizePayload(
    payload: EvolutionMessageWebhookDto,
  ): NormalizedEvolutionMessage {
    const senderId = payload.data.key.remoteJid?.trim();
    const normalizedContent = this.extractNormalizedContent(payload);

    if (!senderId || !normalizedContent.message) {
      throw new BadRequestException(
        'Evolution webhook payload did not contain a valid sender or message.',
      );
    }

    return {
      channel: 'whatsapp',
      senderId,
      senderName: payload.data.pushName,
      message: normalizedContent.message,
      type: normalizedContent.type,
      timestamp: payload.data.messageTimestamp,
      metadata: {
        event: payload.event,
        instance: payload.instance,
        externalMessageId: payload.data.key.id,
        ...normalizedContent.metadata,
      },
    };
  }

  private extractNormalizedContent(payload: EvolutionMessageWebhookDto): {
    message: string;
    type: MessageType;
    metadata: Record<string, unknown>;
  } {
    const directText = payload.data.text?.trim();
    if (directText) {
      return {
        message: directText,
        type: 'text',
        metadata: { contentKind: 'text', rawMessage: payload.data.message },
      };
    }

    const message = payload.data.message;
    if (!message) {
      return { message: '', type: 'text', metadata: {} };
    }

    const conversation = message['conversation'];
    if (typeof conversation === 'string' && conversation.trim()) {
      return {
        message: conversation.trim(),
        type: 'text',
        metadata: { contentKind: 'text', rawMessage: message },
      };
    }

    const extendedText = message['extendedTextMessage'];
    if (
      typeof extendedText === 'object' &&
      extendedText !== null &&
      typeof (extendedText as { text?: unknown }).text === 'string'
    ) {
      return {
        message: ((extendedText as { text: string }).text).trim(),
        type: 'text',
        metadata: { contentKind: 'text', rawMessage: message },
      };
    }

    const imageMessage = this.asMap(message['imageMessage']);
    if (imageMessage != null) {
      return {
        message: this.readString(imageMessage['caption']) || 'Imagen recibida',
        type: 'image',
        metadata: {
          contentKind: 'image',
          mimeType: this.readString(imageMessage['mimetype']),
          caption: this.readString(imageMessage['caption']),
          rawMessage: message,
        },
      };
    }

    const audioMessage = this.asMap(message['audioMessage']);
    if (audioMessage != null) {
      return {
        message: 'Audio recibido',
        type: 'audio',
        metadata: {
          contentKind: 'audio',
          mimeType: this.readString(audioMessage['mimetype']),
          seconds: audioMessage['seconds'],
          voiceNote: audioMessage['ptt'] == true,
          rawMessage: message,
        },
      };
    }

    const videoMessage = this.asMap(message['videoMessage']);
    if (videoMessage != null) {
      return {
        message: this.readString(videoMessage['caption']) || 'Video recibido',
        type: 'video',
        metadata: {
          contentKind: 'video',
          mimeType: this.readString(videoMessage['mimetype']),
          caption: this.readString(videoMessage['caption']),
          seconds: videoMessage['seconds'],
          rawMessage: message,
        },
      };
    }

    const documentMessage =
        this.asMap(message['documentMessage']) ??
        this.asMap(message['stickerMessage']) ??
        this.asMap(message['locationMessage']) ??
        this.asMap(message['contactMessage']);
    if (documentMessage != null) {
      return {
        message:
            this.readString(documentMessage['fileName']) ||
            this.readString(documentMessage['caption']) ||
            'Documento recibido',
        type: 'document',
        metadata: {
          contentKind: this.readString(documentMessage['mimetype']).length > 0
              ? 'document'
              : 'attachment',
          fileName: this.readString(documentMessage['fileName']),
          mimeType: this.readString(documentMessage['mimetype']),
          caption: this.readString(documentMessage['caption']),
          rawMessage: message,
        },
      };
    }

    return {
      message: 'Mensaje recibido',
      type: 'text',
      metadata: { contentKind: 'unknown', rawMessage: message },
    };
  }

  private buildStoredMetadata(
    normalized: NormalizedEvolutionMessage,
    persistMediaMetadata: boolean,
    eventKey: string,
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      ...(normalized.metadata ?? {}),
      eventKey,
    };

    if (!persistMediaMetadata) {
      delete metadata['rawMessage'];
    }

    return metadata;
  }

  private isInboundTypeAllowed(
    type: MessageType,
    settings: {
      receiveTextMessages: boolean;
      receiveAudioMessages: boolean;
      receiveImageMessages: boolean;
      receiveVideoMessages: boolean;
      receiveDocumentMessages: boolean;
    },
  ): boolean {
    switch (type) {
      case 'text':
        return settings.receiveTextMessages;
      case 'audio':
        return settings.receiveAudioMessages;
      case 'image':
        return settings.receiveImageMessages;
      case 'video':
        return settings.receiveVideoMessages;
      case 'document':
        return settings.receiveDocumentMessages;
      default:
        return true;
    }
  }

  private async getWhatsappSettings(): Promise<{
    receiveTextMessages: boolean;
    receiveAudioMessages: boolean;
    receiveImageMessages: boolean;
    receiveVideoMessages: boolean;
    receiveDocumentMessages: boolean;
    persistMediaMetadata: boolean;
    deduplicationEnabled: boolean;
  }> {
    const snapshot = await this.botConfigurationRepository.findOne({
      where: { scope: EvolutionWebhookService.configurationScope },
    });

    const payload = snapshot?.payload as
      | { whatsapp?: Record<string, unknown> }
      | undefined;
    const whatsapp = payload?.whatsapp ?? {};

    return {
      receiveTextMessages: this.readBoolean(whatsapp['receiveTextMessages'], true),
      receiveAudioMessages: this.readBoolean(whatsapp['receiveAudioMessages'], true),
      receiveImageMessages: this.readBoolean(whatsapp['receiveImageMessages'], true),
      receiveVideoMessages: this.readBoolean(whatsapp['receiveVideoMessages'], true),
      receiveDocumentMessages: this.readBoolean(whatsapp['receiveDocumentMessages'], true),
      persistMediaMetadata: this.readBoolean(whatsapp['persistMediaMetadata'], true),
      deduplicationEnabled: this.readBoolean(whatsapp['deduplicationEnabled'], true),
    };
  }

  private asMap(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)
        : null;
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }
}