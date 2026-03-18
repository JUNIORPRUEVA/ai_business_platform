import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    const normalizedJid = this.normalizeRemoteJid(payload.remoteJid);
    const config = await this.resolveOutboundConfig(
      companyId,
      normalizedJid,
      payload.channelConfigId,
    );
    const response = await this.sendTextWithEvolutionFallback(config, normalizedJid, {
      text: payload.text.trim(),
      ...(payload.quotedMessageId ? { quoted: { key: { id: payload.quotedMessageId } } } : {}),
    });

    const chat = await this.findOrCreateChat(config, normalizedJid);
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

  private async sendTextWithEvolutionFallback(
    config: WhatsappChannelConfigEntity,
    remoteJid: string,
    params: { text: string; quoted?: { key: { id: string } } },
  ): Promise<Record<string, unknown>> {
    // Some WhatsApp deployments expose "LID" JIDs (e.g. "...@lid") which are not phone numbers.
    // Evolution payloads differ by version; best-effort: try sending with the raw jid first,
    // then fall back to number candidates.
    const candidates = this.buildEvolutionNumberCandidates(remoteJid);
    let lastError: unknown;

    if (
      remoteJid.includes('@') &&
      (remoteJid.endsWith('@s.whatsapp.net') || remoteJid.endsWith('@lid'))
    ) {
      try {
        return await this.evolutionApiClient.sendText(config, {
          number: remoteJid,
          text: params.text,
          ...(params.quoted ? { quoted: params.quoted } : {}),
        });
      } catch (error) {
        lastError = error;
      }
    }

    for (const candidate of candidates) {
      try {
        return await this.evolutionApiClient.sendText(config, {
          number: candidate,
          text: params.text,
          ...(params.quoted ? { quoted: params.quoted } : {}),
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new BadRequestException('No se pudo enviar el mensaje por Evolution API.');
  }

  async sendMedia(companyId: string, payload: SendWhatsappMediaDto): Promise<Record<string, unknown>> {
    const normalizedJid = this.normalizeRemoteJid(payload.remoteJid);
    const config = await this.resolveOutboundConfig(companyId, normalizedJid);
    const outboundMedia = await this.resolveOutboundMedia(companyId, payload.attachmentId, payload.mediaUrl);

    const response = await this.evolutionApiClient.sendMedia(config, {
      number: this.toEvolutionNumber(normalizedJid),
      mediatype: payload.mediaType,
      mimetype: payload.mimeType ?? outboundMedia.mimeType,
      caption: payload.caption ?? '',
      media: outboundMedia.url,
      fileName: payload.fileName ?? outboundMedia.fileName,
      ...(payload.quotedMessageId ? { quoted: { key: { id: payload.quotedMessageId } } } : {}),
    });

    const chat = await this.findOrCreateChat(config, normalizedJid);
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

    const response = await this.evolutionApiClient.sendWhatsAppAudio(config, {
      number: this.toEvolutionNumber(normalizedJid),
      audio: outboundMedia.url,
      ...(payload.quotedMessageId ? { quoted: { key: { id: payload.quotedMessageId } } } : {}),
    });

    const chat = await this.findOrCreateChat(config, normalizedJid);
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
  ): Promise<WhatsappChatEntity> {
    const existing = await this.chatsRepository.findOne({
      where: { companyId: config.companyId, remoteJid },
    });

    if (existing) {
      if (pushName && !existing.pushName) {
        existing.pushName = pushName;
        return this.chatsRepository.save(existing);
      }
      return existing;
    }

    const entity = this.chatsRepository.create({
      companyId: config.companyId,
      channelConfigId: config.id,
      remoteJid,
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

    const chat = await this.findOrCreateChat(params.config, params.remoteJid, params.pushName);
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

  private toEvolutionNumber(remoteJid: string): string {
    return remoteJid.replace(/@.+$/, '').replace(/\D/g, '');
  }

  private buildEvolutionNumberCandidates(remoteJid: string): string[] {
    const digits = this.toEvolutionNumber(remoteJid);
    if (!digits) {
      throw new BadRequestException('remoteJid no contiene digitos.' );
    }

    if (!remoteJid.endsWith('@lid')) {
      return [digits];
    }

    const candidates: string[] = [];

    const lengthsToTry = digits.startsWith('1') ? [11] : [13, 12, 11];
    for (const length of lengthsToTry) {
      if (digits.length > length && length >= 10) {
        candidates.push(digits.substring(0, length));
        candidates.push(digits.substring(digits.length - length));
      }
    }

    candidates.push(digits);
    return [...new Set(candidates)];
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
}