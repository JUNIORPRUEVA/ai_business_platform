import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StorageService } from '../../storage/storage.service';
import { SendWhatsappAudioDto } from '../dto/send-whatsapp-audio.dto';
import { SendWhatsappMediaDto } from '../dto/send-whatsapp-media.dto';
import { SendWhatsappTextDto } from '../dto/send-whatsapp-text.dto';
import { WhatsappChatEntity } from '../entities/whatsapp-chat.entity';
import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { WhatsappMessageEntity, WhatsappMessageType } from '../entities/whatsapp-message.entity';
import { EvolutionApiClientService } from './evolution-api-client.service';
import { WhatsappAttachmentService } from './whatsapp-attachment.service';
import { WhatsappChannelConfigService } from './whatsapp-channel-config.service';

@Injectable()
export class WhatsappMessagingService {
  private readonly logger = new Logger(WhatsappMessagingService.name);

  constructor(
    @InjectRepository(WhatsappChatEntity)
    private readonly chatsRepository: Repository<WhatsappChatEntity>,
    @InjectRepository(WhatsappMessageEntity)
    private readonly messagesRepository: Repository<WhatsappMessageEntity>,
    private readonly configService: WhatsappChannelConfigService,
    private readonly evolutionApiClient: EvolutionApiClientService,
    private readonly attachmentsService: WhatsappAttachmentService,
    private readonly storageService: StorageService,
  ) {}

  async sendText(companyId: string, payload: SendWhatsappTextDto): Promise<Record<string, unknown>> {
    const rawRemoteJid = payload.remoteJid;
    const normalizedJid = this.normalizeRemoteJid(rawRemoteJid);
    const config = await this.resolveOutboundConfig(
      companyId,
      normalizedJid,
      payload.channelConfigId,
    );

    const recipient = await this.resolveCanonicalRecipient(companyId, normalizedJid);
    const evolutionPayload: Record<string, unknown> = {
      number: recipient.number,
      text: payload.text.trim(),
      ...(payload.quotedMessageId ? { quoted: { key: { id: payload.quotedMessageId } } } : {}),
    };

    this.logger.log(
      `[WHATSAPP OUTBOUND] preparing send companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} rawRemoteJid=${rawRemoteJid} normalizedRemoteJid=${normalizedJid} canonicalRemoteJid=${recipient.jid} canonicalNumber=${recipient.number} messageLength=${payload.text?.trim().length ?? 0}`,
    );
    this.logger.log(
      `[WHATSAPP OUTBOUND] send payload instanceName=${config.instanceName} endpoint=/message/sendText payload=${JSON.stringify(evolutionPayload)}`,
    );

    let response: Record<string, unknown>;
    try {
      response = await this.evolutionApiClient.sendText(config, evolutionPayload);
    } catch (error) {
      this.logger.error(
        `[WHATSAPP OUTBOUND] send failed companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} rawRemoteJid=${rawRemoteJid} normalizedRemoteJid=${normalizedJid} canonicalRemoteJid=${recipient.jid} canonicalNumber=${recipient.number} error=${this.formatErrorForLog(error)}`,
      );
      throw error;
    }

    this.logger.log(
      `[WHATSAPP OUTBOUND] send success instanceName=${config.instanceName} endpoint=/message/sendText response=${this.safeJsonForLog(response)}`,
    );

    const chat = await this.findOrCreateChat(config, normalizedJid, undefined, recipient.jid);
    const message = await this.createOutboundMessage({
      companyId,
      config,
      chat,
      response,
      messageType: 'text',
      textBody: payload.text.trim(),
      caption: null,
      mimeType: null,
      mediaUrl: null,
      mediaStoragePath: null,
      mediaOriginalName: null,
      mediaSizeBytes: null,
      thumbnailUrl: null,
      rawPayloadJson: response,
    });

    return { message: this.toMessageView(message), evolution: response };
  }

  async sendMedia(companyId: string, payload: SendWhatsappMediaDto): Promise<Record<string, unknown>> {
    const normalizedJid = this.normalizeRemoteJid(payload.remoteJid);
    const config = await this.resolveOutboundConfig(companyId, normalizedJid);
    const outboundMedia = await this.resolveOutboundMedia(companyId, payload.attachmentId, payload.mediaUrl);

    const recipient = await this.resolveCanonicalRecipient(companyId, normalizedJid);

    const evolutionPayload: Record<string, unknown> = {
      number: recipient.number,
      mediatype: payload.mediaType,
      mimetype: payload.mimeType ?? outboundMedia.mimeType,
      caption: payload.caption ?? '',
      media: outboundMedia.url,
      fileName: payload.fileName ?? outboundMedia.fileName,
      ...(payload.quotedMessageId ? { quoted: { key: { id: payload.quotedMessageId } } } : {}),
    };

    this.logger.log(
      `[WHATSAPP OUTBOUND] preparing send companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} normalizedRemoteJid=${normalizedJid} canonicalRemoteJid=${recipient.jid} canonicalNumber=${recipient.number} mediaType=${payload.mediaType}`,
    );
    this.logger.log(
      `[WHATSAPP OUTBOUND] send payload instanceName=${config.instanceName} endpoint=/message/sendMedia payload=${this.safeJsonForLog(evolutionPayload)}`,
    );

    let response: Record<string, unknown>;
    try {
      response = await this.evolutionApiClient.sendMedia(config, evolutionPayload);
    } catch (error) {
      this.logger.error(
        `[WHATSAPP OUTBOUND] send failed companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} normalizedRemoteJid=${normalizedJid} canonicalRemoteJid=${recipient.jid} canonicalNumber=${recipient.number} mediaType=${payload.mediaType} error=${this.formatErrorForLog(error)}`,
      );
      throw error;
    }

    this.logger.log(
      `[WHATSAPP OUTBOUND] send success instanceName=${config.instanceName} endpoint=/message/sendMedia response=${this.safeJsonForLog(response)}`,
    );

    const chat = await this.findOrCreateChat(config, normalizedJid, undefined, recipient.jid);
    const message = await this.createOutboundMessage({
      companyId,
      config,
      chat,
      response,
      messageType: payload.mediaType,
      textBody: payload.caption ?? null,
      caption: payload.caption ?? null,
      mimeType: payload.mimeType ?? outboundMedia.mimeType,
      mediaUrl: outboundMedia.url,
      mediaStoragePath: outboundMedia.storagePath,
      mediaOriginalName: payload.fileName ?? outboundMedia.fileName,
      mediaSizeBytes: outboundMedia.sizeBytes,
      thumbnailUrl: null,
      rawPayloadJson: response,
    });

    if (payload.attachmentId) {
      await this.attachmentsService.bindToMessage(payload.attachmentId, message.id);
    }

    return { message: this.toMessageView(message), evolution: response };
  }

  async sendAudio(companyId: string, payload: SendWhatsappAudioDto): Promise<Record<string, unknown>> {
    const normalizedJid = this.normalizeRemoteJid(payload.remoteJid);
    const config = await this.resolveOutboundConfig(companyId, normalizedJid);
    const outboundMedia = await this.resolveOutboundMedia(companyId, payload.attachmentId, payload.audioUrl);

    const recipient = await this.resolveCanonicalRecipient(companyId, normalizedJid);

    const evolutionPayload: Record<string, unknown> = {
      number: recipient.number,
      audio: outboundMedia.url,
      ...(payload.quotedMessageId ? { quoted: { key: { id: payload.quotedMessageId } } } : {}),
    };

    this.logger.log(
      `[WHATSAPP OUTBOUND] preparing send companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} normalizedRemoteJid=${normalizedJid} canonicalRemoteJid=${recipient.jid} canonicalNumber=${recipient.number} mediaType=audio`,
    );
    this.logger.log(
      `[WHATSAPP OUTBOUND] send payload instanceName=${config.instanceName} endpoint=/message/sendWhatsAppAudio payload=${this.safeJsonForLog(evolutionPayload)}`,
    );

    let response: Record<string, unknown>;
    try {
      response = await this.evolutionApiClient.sendWhatsAppAudio(config, evolutionPayload);
    } catch (error) {
      this.logger.error(
        `[WHATSAPP OUTBOUND] send failed companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} normalizedRemoteJid=${normalizedJid} canonicalRemoteJid=${recipient.jid} canonicalNumber=${recipient.number} mediaType=audio error=${this.formatErrorForLog(error)}`,
      );
      throw error;
    }

    this.logger.log(
      `[WHATSAPP OUTBOUND] send success instanceName=${config.instanceName} endpoint=/message/sendWhatsAppAudio response=${this.safeJsonForLog(response)}`,
    );

    const chat = await this.findOrCreateChat(config, normalizedJid, undefined, recipient.jid);
    const message = await this.createOutboundMessage({
      companyId,
      config,
      chat,
      response,
      messageType: 'audio',
      textBody: 'Audio enviado',
      caption: null,
      mimeType: outboundMedia.mimeType,
      mediaUrl: outboundMedia.url,
      mediaStoragePath: outboundMedia.storagePath,
      mediaOriginalName: outboundMedia.fileName,
      mediaSizeBytes: outboundMedia.sizeBytes,
      thumbnailUrl: null,
      rawPayloadJson: response,
    });

    if (payload.attachmentId) {
      await this.attachmentsService.bindToMessage(payload.attachmentId, message.id);
    }

    return { message: this.toMessageView(message), evolution: response };
  }

  async listChats(companyId: string): Promise<Record<string, unknown>[]> {
    const chats = await this.chatsRepository.find({
      where: { companyId },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
      take: 200,
    });

    return chats.map((chat) => ({
      id: chat.id,
      remoteJid: chat.remoteJid,
      pushName: chat.pushName,
      profileName: chat.profileName,
      profilePictureUrl: chat.profilePictureUrl,
      lastMessageAt: chat.lastMessageAt?.toISOString(),
      unreadCount: chat.unreadCount,
    }));
  }

  async listMessages(companyId: string, remoteJid: string): Promise<Record<string, unknown>[]> {
    const normalizedJid = this.normalizeRemoteJid(remoteJid);
    const chat = await this.chatsRepository.findOne({ where: { companyId, remoteJid: normalizedJid } });
    if (!chat) {
      return [];
    }

    const messages = await this.messagesRepository.find({
      where: { companyId, chatId: chat.id },
      order: { createdAt: 'ASC' },
      take: 500,
    });

    return messages.map((message) => this.toMessageView(message));
  }

  async getMessage(companyId: string, messageId: string): Promise<Record<string, unknown>> {
    const message = await this.messagesRepository.findOne({ where: { id: messageId, companyId } });
    if (!message) {
      throw new NotFoundException('Mensaje no encontrado.');
    }

    return this.toMessageView(message);
  }

  async updateStoredMedia(
    companyId: string,
    messageId: string,
    params: { mediaStoragePath: string; mediaSizeBytes: string | null },
  ): Promise<WhatsappMessageEntity> {
    const message = await this.messagesRepository.findOne({ where: { id: messageId, companyId } });
    if (!message) {
      throw new NotFoundException('Mensaje no encontrado.');
    }

    message.mediaStoragePath = params.mediaStoragePath;
    message.mediaSizeBytes = params.mediaSizeBytes;
    return this.messagesRepository.save(message);
  }

  async findOrCreateChat(
    config: WhatsappChannelConfigEntity,
    remoteJid: string,
    pushName?: string | null,
    canonicalRemoteJid?: string | null,
  ): Promise<WhatsappChatEntity> {
    const existing = await this.chatsRepository.findOne({
      where: { companyId: config.companyId, remoteJid },
    });

    if (existing) {
      if (pushName && !existing.pushName) {
        existing.pushName = pushName;
      }

      const normalizedCanonical = this.normalizeCanonicalRemoteJid(canonicalRemoteJid);
      if (normalizedCanonical && existing.canonicalRemoteJid !== normalizedCanonical) {
        existing.canonicalRemoteJid = normalizedCanonical;
        existing.canonicalNumber = this.normalizeOutboundNumber(this.jidToNumber(normalizedCanonical));
      }

      return this.chatsRepository.save(existing);
    }

    const entity = this.chatsRepository.create({
      companyId: config.companyId,
      channelConfigId: config.id,
      remoteJid,
      canonicalRemoteJid: this.normalizeCanonicalRemoteJid(canonicalRemoteJid),
      canonicalNumber: this.normalizeCanonicalRemoteJid(canonicalRemoteJid)
        ? this.normalizeOutboundNumber(this.jidToNumber(this.normalizeCanonicalRemoteJid(canonicalRemoteJid)!))
        : (remoteJid.endsWith('@s.whatsapp.net')
            ? this.normalizeOutboundNumber(this.jidToNumber(remoteJid))
            : null),
      pushName: pushName ?? null,
      profileName: null,
      profilePictureUrl: null,
      lastMessageAt: null,
      unreadCount: 0,
    });

    return this.chatsRepository.save(entity);
  }

  async upsertInboundMessage(params: {
    companyId: string;
    config: WhatsappChannelConfigEntity;
    remoteJid: string;
    canonicalRemoteJid?: string | null;
    pushName?: string | null;
    evolutionMessageId: string | null;
    fromMe: boolean;
    messageType: WhatsappMessageType;
    textBody: string | null;
    caption: string | null;
    mimeType: string | null;
    mediaUrl: string | null;
    mediaOriginalName: string | null;
    thumbnailUrl: string | null;
    rawPayloadJson: Record<string, unknown>;
    status?: string;
  }): Promise<WhatsappMessageEntity> {
    if (params.evolutionMessageId) {
      const existing = await this.messagesRepository.findOne({
        where: { companyId: params.companyId, evolutionMessageId: params.evolutionMessageId },
      });
      if (existing) {
        existing.status = params.status ?? existing.status;
        existing.rawPayloadJson = params.rawPayloadJson;
        return this.messagesRepository.save(existing);
      }
    }

    const chat = await this.findOrCreateChat(
      params.config,
      params.remoteJid,
      params.pushName,
      params.canonicalRemoteJid,
    );
    chat.lastMessageAt = new Date();
    if (!params.fromMe) {
      chat.unreadCount += 1;
    }
    await this.chatsRepository.save(chat);

    const entity = this.messagesRepository.create({
      companyId: params.companyId,
      channelConfigId: params.config.id,
      chatId: chat.id,
      evolutionMessageId: params.evolutionMessageId,
      remoteJid: params.remoteJid,
      fromMe: params.fromMe,
      direction: params.fromMe ? 'outbound' : 'inbound',
      messageType: params.messageType,
      textBody: params.textBody,
      caption: params.caption,
      mimeType: params.mimeType,
      mediaUrl: params.mediaUrl,
      mediaStoragePath: null,
      mediaOriginalName: params.mediaOriginalName,
      mediaSizeBytes: null,
      thumbnailUrl: params.thumbnailUrl,
      rawPayloadJson: params.rawPayloadJson,
      status: params.status ?? (params.fromMe ? 'sent' : 'received'),
      sentAt: params.fromMe ? new Date() : null,
      deliveredAt: null,
      readAt: null,
    });

    return this.messagesRepository.save(entity);
  }

  private async createOutboundMessage(params: {
    companyId: string;
    config: WhatsappChannelConfigEntity;
    chat: WhatsappChatEntity;
    response: Record<string, unknown>;
    messageType: WhatsappMessageType;
    textBody: string | null;
    caption: string | null;
    mimeType: string | null;
    mediaUrl: string | null;
    mediaStoragePath: string | null;
    mediaOriginalName: string | null;
    mediaSizeBytes: string | null;
    thumbnailUrl: string | null;
    rawPayloadJson: Record<string, unknown>;
  }): Promise<WhatsappMessageEntity> {
    params.chat.lastMessageAt = new Date();
    await this.chatsRepository.save(params.chat);

    const key = this.readMap(params.response['key']);
    const entity = this.messagesRepository.create({
      companyId: params.companyId,
      channelConfigId: params.config.id,
      chatId: params.chat.id,
      evolutionMessageId: this.readString(key['id']) || null,
      remoteJid: params.chat.remoteJid,
      fromMe: true,
      direction: 'outbound',
      messageType: params.messageType,
      textBody: params.textBody,
      caption: params.caption,
      mimeType: params.mimeType,
      mediaUrl: params.mediaUrl,
      mediaStoragePath: params.mediaStoragePath,
      mediaOriginalName: params.mediaOriginalName,
      mediaSizeBytes: params.mediaSizeBytes,
      thumbnailUrl: params.thumbnailUrl,
      rawPayloadJson: params.rawPayloadJson,
      status: this.readString(params.response['status']) || 'sent',
      sentAt: new Date(),
      deliveredAt: null,
      readAt: null,
    });

    return this.messagesRepository.save(entity);
  }

  private async resolveOutboundMedia(
    companyId: string,
    attachmentId?: string,
    directUrl?: string,
  ): Promise<{ url: string; mimeType: string | null; fileName: string; storagePath: string | null; sizeBytes: string | null }> {
    if (attachmentId) {
      const attachment = await this.attachmentsService.getById(companyId, attachmentId);
      const signed = await this.storageService.presignDownload({
        companyId,
        key: attachment.storagePath,
      });

      return {
        url: signed.url,
        mimeType: attachment.mimeType,
        fileName: attachment.originalName ?? 'file',
        storagePath: attachment.storagePath,
        sizeBytes: attachment.sizeBytes,
      };
    }

    if (directUrl && directUrl.trim().length > 0) {
      return {
        url: directUrl.trim(),
        mimeType: null,
        fileName: 'remote-file',
        storagePath: null,
        sizeBytes: null,
      };
    }

    throw new BadRequestException('Debes enviar attachmentId o mediaUrl/audioUrl.');
  }

  private async resolveOutboundConfig(
    companyId: string,
    remoteJid: string,
    explicitChannelConfigId?: string,
  ): Promise<WhatsappChannelConfigEntity> {
    if (explicitChannelConfigId) {
      return this.configService.getEntityById(companyId, explicitChannelConfigId);
    }

    const existingChat = await this.chatsRepository.findOne({
      where: { companyId, remoteJid },
    });

    if (existingChat?.channelConfigId) {
      return this.configService.getEntityById(companyId, existingChat.channelConfigId);
    }

    return this.configService.getEntity(companyId);
  }

  private normalizeRemoteJid(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('remoteJid es obligatorio.');
    }
    return trimmed.includes('@') ? trimmed : `${trimmed.replace(/\D/g, '')}@s.whatsapp.net`;
  }

  private normalizeCanonicalRemoteJid(value?: string | null): string | null {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      return null;
    }
    if (!trimmed.endsWith('@s.whatsapp.net')) {
      return null;
    }
    const digits = this.normalizeOutboundNumber(this.jidToNumber(trimmed));
    if (!digits) {
      return null;
    }
    return `${digits}@s.whatsapp.net`;
  }

  private jidToNumber(jid: string): string {
    return jid.replace(/@.+$/, '').replace(/\D/g, '');
  }

  private async resolveCanonicalRecipient(
    companyId: string,
    remoteJid: string,
  ): Promise<{ jid: string; number: string }> {
    if (remoteJid.endsWith('@s.whatsapp.net')) {
      const number = this.normalizeOutboundNumber(this.jidToNumber(remoteJid));
      if (!number) {
        throw new BadRequestException('remoteJid no contiene digitos.');
      }
      return { jid: `${number}@s.whatsapp.net`, number };
    }

    if (remoteJid.endsWith('@lid')) {
      const chat = await this.chatsRepository.findOne({ where: { companyId, remoteJid } });
      const canonical = this.normalizeCanonicalRemoteJid(chat?.canonicalRemoteJid);
      if (canonical) {
        const number = this.normalizeOutboundNumber(this.jidToNumber(canonical));
        if (number) {
          return { jid: canonical, number };
        }
      }

      const lastInbound = await this.messagesRepository.findOne({
        where: { companyId, remoteJid, direction: 'inbound' },
        order: { createdAt: 'DESC' },
      });

      const extracted = lastInbound
        ? this.normalizeCanonicalRemoteJid(
            this.extractCanonicalRemoteJidFromPayload(lastInbound.rawPayloadJson),
          )
        : null;

      if (extracted) {
        const number = this.normalizeOutboundNumber(this.jidToNumber(extracted));
        if (chat) {
          chat.canonicalRemoteJid = extracted;
          chat.canonicalNumber = number;
          await this.chatsRepository.save(chat);
        }
        return { jid: extracted, number };
      }

      throw new BadRequestException(
        `No se puede responder a este chat (@lid) porque no se encontró un destinatario canónico (@s.whatsapp.net) en los datos recibidos. remoteJid=${remoteJid}`,
      );
    }

    throw new BadRequestException(`remoteJid no soportado para envío: ${remoteJid}`);
  }

  private extractCanonicalRemoteJidFromPayload(payload: Record<string, unknown>): string | null {
    // Only accept phone-based JIDs. No scanning/truncation.
    const data = this.readMap(payload['data']);
    const key = this.readMap(data['key']);
    const message = this.readMap(data['message']);

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

    const participantFromContext = (context: Record<string, unknown>): string | null => {
      const participant = this.readString(context['participant']);
      return participant.endsWith('@s.whatsapp.net') ? participant : null;
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
    const reactionParticipant = this.readString(reactionKey['participant']);
    if (reactionParticipant.endsWith('@s.whatsapp.net')) {
      return reactionParticipant;
    }

    return null;
  }

  private toMessageView(message: WhatsappMessageEntity): Record<string, unknown> {
    return {
      id: message.id,
      chatId: message.chatId,
      evolutionMessageId: message.evolutionMessageId,
      remoteJid: message.remoteJid,
      fromMe: message.fromMe,
      direction: message.direction,
      messageType: message.messageType,
      textBody: message.textBody,
      caption: message.caption,
      mimeType: message.mimeType,
      mediaUrl: message.mediaUrl,
      mediaStoragePath: message.mediaStoragePath,
      mediaOriginalName: message.mediaOriginalName,
      mediaSizeBytes: message.mediaSizeBytes,
      thumbnailUrl: message.thumbnailUrl,
      status: message.status,
      sentAt: message.sentAt?.toISOString(),
      deliveredAt: message.deliveredAt?.toISOString(),
      readAt: message.readAt?.toISOString(),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };
  }

  private readMap(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeOutboundNumber(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      return '';
    }

    // Project requirement: when receiving 10-digit NANP numbers (e.g. 8295344286),
    // send with country prefix "1" (e.g. 18295344286).
    if (digits.length === 10) {
      return `1${digits}`;
    }

    if (digits.length === 11 && digits.startsWith('1')) {
      return digits;
    }

    return digits;
  }

  private safeJsonForLog(value: unknown, maxLen = 2000): string {
    try {
      const raw = JSON.stringify(value);
      if (raw.length <= maxLen) {
        return raw;
      }
      return `${raw.slice(0, maxLen)}...<truncated>`;
    } catch {
      return '<unserializable>';
    }
  }

  private formatErrorForLog(error: unknown, maxLen = 1200): string {
    if (error instanceof Error) {
      const stackOrMessage = error.stack ?? error.message;
      return stackOrMessage.length <= maxLen
        ? stackOrMessage
        : `${stackOrMessage.slice(0, maxLen)}...<truncated>`;
    }

    const asString = this.safeJsonForLog(error, maxLen);
    return asString;
  }
}