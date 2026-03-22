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
import { WhatsappJidResolverService } from '../../whatsapp-channel/services/whatsapp-jid-resolver.service';
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
    private readonly jidResolver: WhatsappJidResolverService,
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
    const fromMe = Boolean((params.payload as unknown as { data?: { key?: { fromMe?: boolean } } })?.data?.key?.fromMe);
    if (fromMe) {
      return {
        normalizedMessage: this.normalizePayload(params.payload),
        orchestration: {
          queued: false,
          reason: 'Outbound/self message ignored because fromMe=true.',
        },
      };
    }

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
    const rawRemoteJid =
      typeof normalized.metadata?.['rawRemoteJid'] === 'string'
        ? (normalized.metadata['rawRemoteJid'] as string).trim()
        : '';
    const contactPhone = rawRemoteJid
      ? this.jidResolver.extractPhoneFromJid(rawRemoteJid)
      : normalized.senderId;
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
        remoteJid: rawRemoteJid || undefined,
        conversationId: conversation.id,
        messageId: message.id,
      },
      {
        jobId: `process-inbound-message-${eventKey}`,
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
    const rawRemoteJid = payload.data.key.remoteJid?.trim() ?? '';
    const canonicalSenderJid = this.jidResolver.extractCanonicalRemoteJidFromPayload(
      payload as unknown as Record<string, unknown>,
    );
    const canonicalSenderNumber = canonicalSenderJid
      ? this.jidResolver.normalizeOutboundNumber(this.jidResolver.jidToNumber(canonicalSenderJid))
      : '';
    const rawRemoteNumber = rawRemoteJid
      ? this.jidResolver.extractPhoneFromJid(rawRemoteJid)
      : '';
    const senderId = rawRemoteNumber || canonicalSenderNumber;
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
        rawRemoteJid,
        canonicalSenderJid: canonicalSenderJid || null,
        canonicalSenderNumber: canonicalSenderNumber || null,
        ...normalizedContent.metadata,
      },
    };
  }

  private extractCanonicalRemoteJid(payload: EvolutionMessageWebhookDto): string | null {
    const data = this.asMap(payload.data) ?? {};
    const key = this.asMap(data['key']) ?? {};
    const message = this.asMap(data['message']) ?? {};
    const remoteJid = this.readString(key['remoteJid']);
    const disallowedDigits = this.buildDisallowedDigits(remoteJid);

    const candidates = [
      this.readString(key['participantJid']),
      this.readString(key['participant']),
      this.readString(key['participantPn']),
      this.readString(key['sender']),
      this.readString(key['senderJid']),
      this.readString(key['senderPn']),
      this.readString(data['participant']),
      this.readString(data['participantJid']),
      this.readString(data['participantPn']),
      this.readString(data['sender']),
      this.readString(data['senderJid']),
      this.readString(data['senderPn']),
      this.readString(data['senderId']),
      this.readString(data['sender_id']),
      this.readString(data['author']),
      this.readString(data['authorJid']),
      this.readString(data['from']),
      this.readString(data['fromJid']),
      this.readString(data['phone']),
      this.readString(data['phoneNumber']),
      this.readString(data['wa_id']),
      this.readString(data['waId']),
      this.readString((this.asMap(data['source']) ?? {})['sender']),
      this.readString((this.asMap(data['source']) ?? {})['senderJid']),
      this.readString((this.asMap(data['source']) ?? {})['senderPn']),
      this.readString((this.asMap(data['source']) ?? {})['phone']),
      this.readString((this.asMap(data['source']) ?? {})['phoneNumber']),
      this.readString((this.asMap(data['source']) ?? {})['wa_id']),
      this.readString((this.asMap(data['source']) ?? {})['waId']),
    ];

    for (const candidate of candidates) {
      const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
      if (canonical) {
        return canonical;
      }
    }

    const contacts = data['contacts'];
    if (Array.isArray(contacts)) {
      for (const item of contacts) {
        const contact = this.asMap(item) ?? {};
        const contactCandidates = [
          this.readString(contact['id']),
          this.readString(contact['jid']),
          this.readString(contact['wa_id']),
          this.readString(contact['waId']),
          this.readString(contact['phone']),
          this.readString(contact['phoneNumber']),
          this.readString(contact['number']),
        ];
        for (const candidate of contactCandidates) {
          const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
          if (canonical) {
            return canonical;
          }
        }
      }
    }

    return this.extractCanonicalByHeuristicScan(
      {
        data,
        key,
        message,
        source: this.asMap(data['source']) ?? {},
      },
      disallowedDigits,
    );
  }

  private extractCanonicalByHeuristicScan(
    value: unknown,
    disallowedDigits: Set<string>,
    path = '',
    depth = 0,
  ): string | null {
    if (depth > 5 || value == null) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const lastSegment = path.split('.').slice(-1)[0]?.toLowerCase() ?? '';
      if (!this.shouldInspectCanonicalPath(lastSegment)) {
        return null;
      }
      return this.resolveCanonicalCandidate(String(value), disallowedDigits);
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const nested = this.extractCanonicalByHeuristicScan(
          value[index],
          disallowedDigits,
          `${path}[${index}]`,
          depth + 1,
        );
        if (nested) {
          return nested;
        }
      }
      return null;
    }

    const map = this.asMap(value);
    if (!map) {
      return null;
    }

    for (const [key, nestedValue] of Object.entries(map)) {
      const nextPath = path ? `${path}.${key}` : key;
      const nested = this.extractCanonicalByHeuristicScan(
        nestedValue,
        disallowedDigits,
        nextPath,
        depth + 1,
      );
      if (nested) {
        return nested;
      }
    }

    return null;
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
    return settings.receiveTextMessages &&
        settings.receiveAudioMessages &&
        settings.receiveImageMessages &&
        settings.receiveVideoMessages &&
        settings.receiveDocumentMessages;
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
      receiveTextMessages: true,
      receiveAudioMessages: true,
      receiveImageMessages: true,
      receiveVideoMessages: true,
      receiveDocumentMessages: true,
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

  private resolveCanonicalCandidate(value: string, disallowedDigits: Set<string>): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.endsWith('@lid') || trimmed.endsWith('@g.us')) {
      return null;
    }

    if (trimmed.endsWith('@s.whatsapp.net')) {
      const normalized = this.normalizeOutboundNumber(this.jidToNumber(trimmed));
      if (!normalized || disallowedDigits.has(normalized)) {
        return null;
      }
      return `${normalized}@s.whatsapp.net`;
    }

    if (trimmed.includes('@')) {
      return null;
    }

    const normalized = this.normalizeOutboundNumber(trimmed.replace(/\D/g, ''));
    if (normalized.length < 10 || normalized.length > 15 || disallowedDigits.has(normalized)) {
      return null;
    }

    return `${normalized}@s.whatsapp.net`;
  }

  private buildDisallowedDigits(remoteJid: string): Set<string> {
    const digits = remoteJid.replace(/@.+$/, '').replace(/\D/g, '');
    return digits ? new Set([digits]) : new Set();
  }

  private jidToNumber(jid: string): string {
    return jid.replace(/@.+$/, '').replace(/\D/g, '');
  }

  private normalizeOutboundNumber(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return '';
    }

    if (digits.length === 10) {
      return `1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return digits;
    }

    return digits;
  }

  private shouldInspectCanonicalPath(segment: string): boolean {
    if (!segment) {
      return false;
    }

    const normalized = segment.replace(/\[\d+\]/g, '').toLowerCase();
    if (
      normalized.includes('remotejid') ||
      normalized.includes('messageid') ||
      normalized.includes('timestamp') ||
      normalized.includes('instanceid') ||
      normalized === 'status' ||
      normalized === 'type'
    ) {
      return false;
    }

    return normalized.includes('sender') ||
      normalized.includes('participant') ||
      normalized.includes('author') ||
      normalized.includes('owner') ||
      normalized.includes('contact') ||
      normalized.includes('phone') ||
      normalized.includes('number') ||
      normalized.includes('jid') ||
      normalized.includes('wa_id') ||
      normalized.includes('waid') ||
      normalized.includes('from') ||
      normalized.endsWith('pn');
  }
}
