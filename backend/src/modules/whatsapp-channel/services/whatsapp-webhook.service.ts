import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';

import { ChannelsService } from '../../channels/channels.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessagesService } from '../../messages/messages.service';
import { MessageProcessingJob } from '../../workers/processors/message-processing.processor';
import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { WhatsappChatEntity } from '../entities/whatsapp-chat.entity';
import { WhatsappMessageType } from '../entities/whatsapp-message.entity';
import { WhatsappAttachmentService } from './whatsapp-attachment.service';
import { BotCenterRealtimeService } from './bot-center-realtime.service';
import { WhatsappChannelConfigService } from './whatsapp-channel-config.service';
import { WhatsappChannelLogService } from './whatsapp-channel-log.service';
import { EvolutionApiClientService } from './evolution-api-client.service';
import { WhatsappJidResolverService } from './whatsapp-jid-resolver.service';
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
    @InjectQueue('message-processing')
    private readonly messageProcessingQueue: Queue<MessageProcessingJob>,
    @InjectRepository(WhatsappChannelConfigEntity)
    private readonly configsRepository: Repository<WhatsappChannelConfigEntity>,
    @InjectRepository(WhatsappChatEntity)
    private readonly chatsRepository: Repository<WhatsappChatEntity>,
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly appMessagesService: MessagesService,
    private readonly configService: WhatsappChannelConfigService,
    private readonly logsService: WhatsappChannelLogService,
    private readonly messagingService: WhatsappMessagingService,
    private readonly botCenterRealtimeService: BotCenterRealtimeService,
    private readonly attachmentsService: WhatsappAttachmentService,
    private readonly evolutionApiClient: EvolutionApiClientService,
    private readonly jidResolver: WhatsappJidResolverService,
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
      case 'MESSAGE_RECEIPT':
      case 'MESSAGE_RECEIPTS':
      case 'MESSAGE_ACK':
      case 'MESSAGE_ACKS':
      case 'ACK':
      case 'ACK_UPDATE':
      case 'ACK_UPDATES':
        for (const payload of canonicalPayloads) {
          await this.handleMessageStatusUpdate(job.companyId, payload);
        }
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
    const statusUpdate = this.extractStatusUpdate(payload);
    const messageId = statusUpdate.messageId;
    if (!messageId) {
      this.logger.warn('[EVOLUTION INBOUND] status update ignored reason=missing_message_id');
      return;
    }

    const message = await this.messagingService.applyStatusUpdate({
      companyId,
      evolutionMessageId: messageId,
      fromMe: statusUpdate.fromMe,
      rawPayloadJson: payload,
      status: statusUpdate.status,
    });
    if (!message) {
      this.logger.warn(
        `[EVOLUTION INBOUND] status update ignored reason=message_not_found evolutionMessageId=${messageId}`,
      );
      return;
    }

    const loggedStatus =
      typeof statusUpdate.status === 'number'
        ? String(statusUpdate.status)
        : this.readString(statusUpdate.status) || 'updated';
    this.logger.log(
      `[EVOLUTION INBOUND] message status saved id=${message.id} chatId=${message.chatId} companyId=${companyId} remoteJid=${message.remoteJid} status=${loggedStatus}`,
    );
    await this.botCenterRealtimeService.publishMessageStatus(message);
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
    const rawRemoteJid = this.readString(key['remoteJid']);
    const remoteJid = this.jidResolver.normalizeRemoteJid(rawRemoteJid);
    if (!remoteJid) {
      this.logger.warn('[EVOLUTION INBOUND] message ignored reason=missing_remote_jid');
      return null;
    }

    const messageId = this.readString(key['id']) || null;
    const fromMe = this.readBoolean(key['fromMe']);
    const message = this.readMap(data['message']);
    const type = this.detectType(message);
    const content = this.extractContent(type, message);

    const canonicalRemoteJid = await this.resolveCanonicalRemoteJid(
      config,
      data,
      key,
      message,
      payload,
      remoteJid,
      messageId,
    );

    this.logger.log(
      `[INBOUND JID RESOLUTION] companyId=${config.companyId} instanceName=${config.instanceName} remoteJidOriginal=${rawRemoteJid || '(none)'} remoteJidNormalized=${remoteJid} canonicalJid=${canonicalRemoteJid ?? '(none)'} canReply=${remoteJid.endsWith('@lid') ? canonicalRemoteJid != null : true}`,
    );

    if (remoteJid.endsWith('@lid') && !canonicalRemoteJid) {
      this.logger.warn(
        `[EVOLUTION INBOUND] missing canonical recipient remoteJid=${remoteJid} messageId=${messageId ?? '(none)'} keysPresent=${Object.keys(data).slice(0, 30).join(',')} source=${this.stringifyForLog(this.readMap(data['source']))}`,
      );
    }

    this.logger.log(
      `[EVOLUTION INBOUND] instance=${config.instanceName} companyId=${config.companyId} remoteJid=${remoteJid} messageId=${messageId ?? '(none)'} type=${type} accepted=${type !== 'unknown' || content.textBody != null}`,
    );

    const saved = await this.messagingService.upsertInboundMessage({
      companyId: config.companyId,
      config,
      remoteJid,
      canonicalRemoteJid,
        rawRemoteJid: rawRemoteJid ? rawRemoteJid : null,
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
      durationSeconds: content.durationSeconds,
      rawPayloadJson: payload,
      status: fromMe ? 'sent' : 'received',
    });

    this.logger.log(
      `[EVOLUTION INBOUND] chat resolved id=${saved.chatId} companyId=${config.companyId} remoteJid=${remoteJid}`,
    );
    this.logger.log(
      `[EVOLUTION INBOUND] message saved id=${saved.id} type=${saved.messageType} companyId=${config.companyId} remoteJid=${remoteJid}`,
    );

    let messageForRealtime = saved;

    if (type !== 'text' && type !== 'system' && type !== 'unknown') {
      const attachment = await this.attachmentsService.downloadRemoteToStorage({
        config,
        companyId: config.companyId,
        conversationId: saved.chatId,
        messageId: saved.id,
        fileType: type,
        mimeType: content.mimeType,
        originalName: content.mediaOriginalName ?? `${type}-${saved.id}`,
        sourceUrl: content.mediaUrl,
        thumbnailSource: content.thumbnailUrl,
        messagePayload: message,
        metadataJson: { thumbnailUrl: content.thumbnailUrl },
      });

      if (attachment) {
        const thumbnailStoragePath = this.readString(attachment.metadataJson['thumbnailStoragePath']) || null;
        const storedDurationSeconds = this.readOptionalNumber(attachment.metadataJson['durationSeconds']);
        messageForRealtime = await this.messagingService.updateStoredMedia(config.companyId, saved.id, {
          mediaStoragePath: attachment.storagePath,
          mediaSizeBytes: attachment.sizeBytes,
          mimeType: attachment.mimeType,
          thumbnailUrl: thumbnailStoragePath,
          durationSeconds: storedDurationSeconds ?? content.durationSeconds,
        });
      }
    }

    await this.botCenterRealtimeService.publishMessageUpsert(messageForRealtime);

    if (!fromMe) {
      await this.triggerAiAutoReply(config, messageForRealtime.chatId, messageForRealtime.id, content.textBody);
    }

    return {
      messageId: saved.id,
      chatId: saved.chatId,
      remoteJid: saved.remoteJid,
      messageType: saved.messageType,
      fromMe: saved.fromMe,
    };
  }

  private async triggerAiAutoReply(
    config: WhatsappChannelConfigEntity,
    chatId: string,
    whatsappMessageId: string,
    textBody: string | null,
  ): Promise<void> {
    const chat = await this.chatsRepository.findOne({
      where: { id: chatId, companyId: config.companyId },
    });
    if (!chat) {
      return;
    }

    if (!chat.autoReplyEnabled) {
      this.logger.log(
        `[AI AUTO REPLY] skipped companyId=${config.companyId} chatId=${chatId} reason=chat_auto_reply_disabled`,
      );
      return;
    }

    const contactPhone = this.resolveConversationContactPhone(chat);
    if (!contactPhone) {
      this.logger.warn(
        `[AI AUTO REPLY] skipped companyId=${config.companyId} chatId=${chatId} reason=missing_contact_phone`,
      );
      return;
    }

    let channelId = '';
    try {
      const channel = await this.channelsService.getByInstanceNameUnsafe(config.instanceName);
      if (channel.companyId !== config.companyId) {
        return;
      }
      channelId = channel.id;
    } catch (error) {
      this.logger.warn(
        `[AI AUTO REPLY] skipped companyId=${config.companyId} chatId=${chatId} reason=channel_resolution_failed error=${error instanceof Error ? error.message : 'unknown'}`,
      );
      return;
    }

    const contact = await this.contactsService.findOrCreateByPhone(
      config.companyId,
      contactPhone,
      chat.pushName || chat.profileName,
    );
    const conversation = await this.conversationsService.findOrCreateOpen(
      config.companyId,
      channelId,
      contact.id,
    );

    const existingMessage = await this.appMessagesService.findByMetadataValue(
      config.companyId,
      conversation.id,
      'whatsappChannelMessageId',
      whatsappMessageId,
    );
    if (existingMessage) {
      return;
    }

    const createdMessage = await this.appMessagesService.create(
      config.companyId,
      conversation.id,
      {
        sender: 'client',
        content: (() => {
          const normalizedText = textBody?.trim() ?? '';
          return normalizedText.length > 0 ? normalizedText : 'Mensaje recibido por WhatsApp.';
        })(),
        type: 'text',
        metadata: {
          source: 'whatsapp-channel-auto-reply',
          botCenterConversationId: chat.id,
          whatsappChannelMessageId: whatsappMessageId,
          remoteJid: chat.remoteJid,
        },
      },
    );

    await this.messageProcessingQueue.add(
      'process-inbound-message',
      {
        companyId: config.companyId,
        channelId,
        contactPhone,
        conversationId: conversation.id,
        messageId: createdMessage.id,
      },
      {
        jobId: `whatsapp-channel-auto-reply:${whatsappMessageId}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    this.logger.log(
      `[AI AUTO REPLY] queued companyId=${config.companyId} chatId=${chat.id} appConversationId=${conversation.id} appMessageId=${createdMessage.id}`,
    );
  }

  private resolveConversationContactPhone(chat: WhatsappChatEntity): string {
    const candidates = [
      chat.sendTarget,
      chat.canonicalNumber,
      chat.canonicalRemoteJid,
      chat.remoteJid,
    ];

    for (const raw of candidates) {
      const candidate = this.readString(raw);
      if (!candidate) {
        continue;
      }
      const digits = candidate.replace(/\D/g, '');
      if (digits) {
        return digits;
      }
    }

    return '';
  }

  private detectType(message: Record<string, unknown>): WhatsappMessageType {
    if (message['conversation'] != null || message['extendedTextMessage'] != null) return 'text';
    if (message['imageMessage'] != null) return 'image';
    if (message['videoMessage'] != null) return 'video';
    if (message['audioMessage'] != null || message['pttMessage'] != null) return 'audio';
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
    durationSeconds: number | null;
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
        durationSeconds: null,
      };
    }

    const media =
      type === 'image'
        ? this.readMap(message['imageMessage'])
        : type === 'video'
            ? this.readMap(message['videoMessage'])
            : type === 'audio'
                ? this.readMap(message['audioMessage'] ?? message['pttMessage'])
                : this.readMap(message['documentMessage']);

    return {
      textBody: type === 'audio' ? 'Audio recibido' : this.readString(media['caption']) || `${type} recibido`,
      caption: this.readString(media['caption']) || null,
      mimeType: this.readString(media['mimetype']) || null,
      mediaUrl: this.readString(media['url']) || null,
      mediaOriginalName: this.readString(media['fileName']) || null,
      thumbnailUrl: this.readString(media['jpegThumbnail']) || null,
      durationSeconds: this.readOptionalNumber(media['seconds']),
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

  private async resolveCanonicalRemoteJid(
    config: WhatsappChannelConfigEntity,
    data: Record<string, unknown>,
    key: Record<string, unknown>,
    message: Record<string, unknown>,
    payload: Record<string, unknown>,
    remoteJid: string,
    messageId: string | null,
  ): Promise<string | null> {
    const localCanonical = this.jidResolver.extractCanonicalRemoteJidFromPayload(payload);
    if (localCanonical) {
      return localCanonical;
    }

    const fallbackCanonical = this.jidResolver.extractCanonicalRemoteJid(data, key, message, remoteJid);
    if (fallbackCanonical) {
      return fallbackCanonical;
    }

    if (!remoteJid.endsWith('@lid')) {
      return null;
    }

    const resolvedViaApi = await this.jidResolver.lookupCanonicalRemoteJidFromEvolution(config, remoteJid);
    if (resolvedViaApi) {
      this.logger.log(
        `[EVOLUTION INBOUND] canonical recipient enriched instance=${config.instanceName} companyId=${config.companyId} remoteJid=${remoteJid} canonicalJid=${resolvedViaApi} source=evolution_lookup messageId=${messageId ?? '(none)'}`,
      );
      return resolvedViaApi;
    }

    return null;
  }

  private extractCanonicalRemoteJid(
    data: Record<string, unknown>,
    key: Record<string, unknown>,
    message: Record<string, unknown>,
    remoteJid: string,
  ): string | null {
    const disallowedDigits = this.buildDisallowedDigits(remoteJid);
    const candidates = [
      this.readString(key['participantJid']),
      this.readString(key['participant']),
      this.readString(key['participantPn']),
      this.readString(key['senderPn']),
      this.readString(key['sender']),
      this.readString(key['senderJid']),
      this.readString(key['from']),
      this.readString(data['participant']),
      this.readString(data['participantJid']),
      this.readString(data['sender']),
      this.readString(data['senderJid']),
      this.readString(data['participantPn']),
      this.readString(data['senderPn']),
      this.readString(data['senderId']),
      this.readString(data['sender_id']),
      this.readString(data['participantId']),
      this.readString(data['participant_id']),
      this.readString(data['author']),
      this.readString(data['authorJid']),
      this.readString(data['from']),
      this.readString(data['fromJid']),
      this.readString(data['fromPn']),
      this.readString(data['owner']),
      this.readString(data['ownerJid']),
      this.readString(data['ownerPn']),
      this.readString(data['phone']),
      this.readString(data['phoneNumber']),
      this.readString(data['wa_id']),
      this.readString(data['waId']),
      this.readString(this.readMap(data['messageContextInfo'])['participant']),
      this.readString(this.readMap(data['messageContextInfo'])['participantPn']),
      this.readString(this.readMap(data['messageContextInfo'])['senderPn']),
      this.readString(this.readMap(data['messageContextInfo'])['sender']),
      this.readString(this.readMap(data['messageContextInfo'])['senderJid']),
      this.readString(this.readMap(data['source'])['participant']),
      this.readString(this.readMap(data['source'])['participantPn']),
      this.readString(this.readMap(data['source'])['sender']),
      this.readString(this.readMap(data['source'])['senderPn']),
      this.readString(this.readMap(data['source'])['senderJid']),
      this.readString(this.readMap(data['source'])['phone']),
      this.readString(this.readMap(data['source'])['phoneNumber']),
      this.readString(this.readMap(data['source'])['wa_id']),
      this.readString(this.readMap(data['source'])['waId']),
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
        if (typeof item !== 'object' || item == null) continue;
        const contact = item as Record<string, unknown>;
        const contactCandidates = [
          this.readString(contact['id']),
          this.readString(contact['jid']),
          this.readString(contact['wa_id']),
          this.readString(contact['waId']),
          this.readString(contact['phoneNumber']),
          this.readString(contact['phone']),
          this.readString(contact['number']),
          this.readString(contact['user']),
        ];

        for (const candidate of contactCandidates) {
          const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
          if (canonical) {
            return canonical;
          }
        }
      }
    }

    const participantFromContext = (context: Record<string, unknown>): string | null => {
      const contextCandidates = [
        this.readString(context['participant']),
        this.readString(context['participantPn']),
        this.readString(context['participantJid']),
        this.readString(context['sender']),
        this.readString(context['senderPn']),
        this.readString(context['senderJid']),
        this.readString(context['author']),
        this.readString(context['authorJid']),
        this.readString(context['phone']),
        this.readString(context['phoneNumber']),
        this.readString(context['wa_id']),
        this.readString(context['waId']),
      ];

      for (const candidate of contextCandidates) {
        const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
        if (canonical) {
          return canonical;
        }
      }

      return null;
    };

    const extended = this.readMap(message['extendedTextMessage']);
    const topContext = this.readMap(extended['contextInfo'] ?? message['contextInfo']);
    const direct = participantFromContext(topContext);
    if (direct) {
      return direct;
    }

    const mediaContexts: Array<Record<string, unknown>> = [
      this.readMap(this.readMap(message['imageMessage'])['contextInfo']),
      this.readMap(this.readMap(message['videoMessage'])['contextInfo']),
      this.readMap(this.readMap(message['audioMessage'])['contextInfo']),
      this.readMap(this.readMap(message['documentMessage'])['contextInfo']),
    ];

    for (const ctx of mediaContexts) {
      const p = participantFromContext(ctx);
      if (p) {
        return p;
      }
    }

    const reaction = this.readMap(message['reactionMessage']);
    const reactionKey = this.readMap(reaction['key']);
    const reactionParticipant = this.resolveCanonicalCandidate(
      this.readString(reactionKey['participant']),
      disallowedDigits,
    );
    if (reactionParticipant) {
      return reactionParticipant;
    }

    return this.extractCanonicalByHeuristicScan(
      {
        data,
        key,
        message,
        source: this.readMap(data['source']),
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

    if (typeof value !== 'object') {
      return null;
    }

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
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

  private async lookupCanonicalRemoteJidFromEvolution(
    config: WhatsappChannelConfigEntity,
    remoteJid: string,
  ): Promise<string | null> {
    const lookups: Array<{
      source: 'findContacts' | 'findChats';
      body: Record<string, unknown>;
    }> = [
      { source: 'findContacts', body: { where: { id: remoteJid } } },
      { source: 'findContacts', body: { where: { remoteJid } } },
      { source: 'findContacts', body: { where: { jid: remoteJid } } },
      { source: 'findChats', body: { where: { id: remoteJid } } },
      { source: 'findChats', body: { where: { remoteJid } } },
      { source: 'findChats', body: { where: { jid: remoteJid } } },
    ];

    for (const lookup of lookups) {
      try {
        const response =
          lookup.source === 'findContacts'
            ? await this.evolutionApiClient.findContacts(config, lookup.body)
            : await this.evolutionApiClient.findChats(config, lookup.body);
        const canonical = this.extractCanonicalRemoteJidFromLookupResponse(response, remoteJid);
        if (canonical) {
          this.logger.log(
            `[EVOLUTION INBOUND] lookup match instance=${config.instanceName} remoteJid=${remoteJid} canonicalJid=${canonical} source=${lookup.source} query=${this.stringifyForLog(lookup.body)}`,
          );
          return canonical;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'lookup_failed';
        this.logger.warn(
          `[EVOLUTION INBOUND] lookup failed instance=${config.instanceName} remoteJid=${remoteJid} source=${lookup.source} query=${this.stringifyForLog(lookup.body)} error=${message}`,
        );
      }
    }

    return null;
  }

  private extractCanonicalRemoteJidFromLookupResponse(
    response: Record<string, unknown>,
    remoteJid: string,
  ): string | null {
    const disallowedDigits = this.buildDisallowedDigits(remoteJid);
    const matchedObjects = this.collectLookupMatches(response, remoteJid);

    for (const item of matchedObjects) {
      const canonical = this.extractCanonicalFromLookupObject(item, disallowedDigits);
      if (canonical) {
        return canonical;
      }
    }

    return this.extractCanonicalByHeuristicScan(response, disallowedDigits);
  }

  private collectLookupMatches(value: unknown, remoteJid: string, depth = 0): Record<string, unknown>[] {
    if (depth > 6 || value == null) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.collectLookupMatches(item, remoteJid, depth + 1));
    }

    if (typeof value !== 'object') {
      return [];
    }

    const map = value as Record<string, unknown>;
    const matches: Record<string, unknown>[] = [];
    const directCandidates = [
      this.readString(map['id']),
      this.readString(map['jid']),
      this.readString(map['remoteJid']),
      this.readString(map['remote_jid']),
      this.readString(map['lid']),
      this.readString(map['userLid']),
      this.readString(map['user_lid']),
      this.readString(this.readMap(map['key'])['remoteJid']),
    ];

    if (directCandidates.some((candidate) => candidate === remoteJid)) {
      matches.push(map);
    }

    for (const nested of Object.values(map)) {
      matches.push(...this.collectLookupMatches(nested, remoteJid, depth + 1));
    }

    return matches;
  }

  private extractCanonicalFromLookupObject(
    value: Record<string, unknown>,
    disallowedDigits: Set<string>,
  ): string | null {
    const candidates = [
      this.readString(value['canonicalJid']),
      this.readString(value['canonical_jid']),
      this.readString(value['jid']),
      this.readString(value['contactJid']),
      this.readString(value['contact_jid']),
      this.readString(value['ownerJid']),
      this.readString(value['owner_jid']),
      this.readString(value['participantJid']),
      this.readString(value['participant_jid']),
      this.readString(value['phone']),
      this.readString(value['phoneNumber']),
      this.readString(value['number']),
      this.readString(value['wa_id']),
      this.readString(value['waId']),
      this.readString(this.readMap(value['contact'])['jid']),
      this.readString(this.readMap(value['contact'])['phone']),
      this.readString(this.readMap(value['contact'])['number']),
    ];

    for (const candidate of candidates) {
      const canonical = this.resolveCanonicalCandidate(candidate, disallowedDigits);
      if (canonical) {
        return canonical;
      }
    }

    return this.extractCanonicalByHeuristicScan(value, disallowedDigits);
  }

  private readMap(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private resolveCanonicalCandidate(value: string, disallowedDigits: Set<string> = new Set()): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.endsWith('@lid') || trimmed.endsWith('@g.us')) {
      return null;
    }

    if (trimmed.endsWith('@s.whatsapp.net')) {
      const digits = trimmed.replace(/@.+$/, '').replace(/\D/g, '');
      if (!digits) {
        return null;
      }
      const normalized = digits.length === 10 ? `1${digits}` : digits;
      return `${normalized}@s.whatsapp.net`;
    }

    if (trimmed.includes('@')) {
      return null;
    }

    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }
    if (disallowedDigits.has(digits)) {
      return null;
    }

    const normalized = digits.length === 10 ? `1${digits}` : digits;
    return `${normalized}@s.whatsapp.net`;
  }

  private buildDisallowedDigits(remoteJid: string): Set<string> {
    const digits = remoteJid.replace(/@.+$/, '').replace(/\D/g, '');
    return digits ? new Set([digits]) : new Set();
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

  private readBoolean(value: unknown): boolean {
    return value === true;
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

  private readOptionalBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        return true;
      }
      if (value.toLowerCase() === 'false') {
        return false;
      }
    }

    return null;
  }

  private stringifyForLog(value: unknown): string {
    try {
      const json = JSON.stringify(value);
      if (!json) {
        return '(empty)';
      }
      return json.length > 2000 ? `${json.slice(0, 2000)}...(truncated)` : json;
    } catch {
      return '(unserializable)';
    }
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
    const collectionKey = ['messages', 'receipts', 'updates', 'statuses', 'acks'].find((key) => {
      const value = data[key];
      return Array.isArray(value) && value.length > 0;
    });
    if (!collectionKey) {
      return [payload];
    }

    const items = data[collectionKey] as Array<unknown>;

    const sharedData = { ...data };
    delete sharedData[collectionKey];

    return items
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
          key: {
            ...this.readMap(item['message_key']),
            ...this.readMap(item['messageKey']),
            ...this.readMap(item['receipt']),
            ...this.readMap(item['update']),
            ...this.readMap(item['key']),
          },
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

  private extractStatusUpdate(payload: Record<string, unknown>): {
    messageId: string;
    status: unknown;
    fromMe: boolean | null;
  } {
    const data = this.readMap(payload['data']);
    const receipt = this.readMap(data['receipt']);
    const update = this.readMap(data['update']);
    const key = this.readMap(data['key']);
    const messageKey = this.readMap(data['messageKey']);
    const messageKeySnake = this.readMap(data['message_key']);

    const mergedKey = {
      ...messageKeySnake,
      ...messageKey,
      ...receipt,
      ...update,
      ...key,
    };

    return {
      messageId:
        this.readString(mergedKey['id']) ||
        this.readString(data['messageId']) ||
        this.readString(data['message_id']) ||
        this.readString(payload['messageId']) ||
        this.readString(payload['message_id']),
      status:
        data['status'] ??
        receipt['status'] ??
        update['status'] ??
        data['ack'] ??
        receipt['ack'] ??
        update['ack'] ??
        payload['status'] ??
        payload['ack'],
      fromMe:
        this.readOptionalBoolean(mergedKey['fromMe']) ??
        this.readOptionalBoolean(data['fromMe']) ??
        this.readOptionalBoolean(payload['fromMe']),
    };
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
