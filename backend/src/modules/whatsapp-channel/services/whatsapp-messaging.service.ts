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
import { WhatsappJidResolverService } from './whatsapp-jid-resolver.service';

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
    private readonly jidResolver: WhatsappJidResolverService,
  ) {}

  async diagnoseRecipientResolution(
    companyId: string,
    remoteJid: string,
  ): Promise<{
    rawRemoteJid: string;
    normalizedRemoteJid: string;
    safeToSend: boolean;
    reason?: string;
    canonicalJid: string | null;
    canonicalNumber: string | null;
    finalSendTarget: string | null;
    chatRemoteJid: string | null;
    outboundRemoteJid: string | null;
    source: 'remoteJid' | 'chat' | 'last_inbound_payload' | null;
  }> {
    const rawRemoteJid = remoteJid;
    const normalizedRemoteJid = this.jidResolver.normalizeRemoteJid(rawRemoteJid, { throwOnEmpty: true });

    try {
      const resolved = await this.resolveOutboundRecipientWithSource(companyId, normalizedRemoteJid);
      return {
        rawRemoteJid,
        normalizedRemoteJid,
        safeToSend: true,
        canonicalJid: resolved.jid,
        canonicalNumber: resolved.number,
        finalSendTarget: resolved.sendTarget,
        chatRemoteJid: resolved.chatRemoteJid,
        outboundRemoteJid: resolved.remoteJid,
        source: resolved.source,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'canonical_target_not_found';
      return {
        rawRemoteJid,
        normalizedRemoteJid,
        safeToSend: false,
        reason: message,
        canonicalJid: null,
        canonicalNumber: null,
        finalSendTarget: null,
        chatRemoteJid: null,
        outboundRemoteJid: null,
        source: null,
      };
    }
  }

  async findByEvolutionMessageId(
    companyId: string,
    evolutionMessageId: string | null,
  ): Promise<WhatsappMessageEntity | null> {
    const normalizedMessageId = this.readString(evolutionMessageId);
    if (!normalizedMessageId) {
      return null;
    }

    return this.messagesRepository.findOne({
      where: { companyId, evolutionMessageId: normalizedMessageId },
    });
  }

  async sendText(companyId: string, payload: SendWhatsappTextDto): Promise<Record<string, unknown>> {
    const rawRemoteJid = payload.remoteJid;
    const normalizedJid = this.jidResolver.normalizeRemoteJid(rawRemoteJid, { throwOnEmpty: true });
    const resolution = await this.diagnoseRecipientResolution(companyId, normalizedJid);
    const config = await this.resolveOutboundConfig(
      companyId,
      normalizedJid,
      payload.channelConfigId,
    );

    if (!resolution.safeToSend || !resolution.finalSendTarget || !resolution.outboundRemoteJid || !resolution.chatRemoteJid) {
      this.logger.warn(
        `[BOT SEND RESOLUTION] companyId=${companyId} remoteJidOriginal=${rawRemoteJid} normalizedRemoteJid=${normalizedJid} canonicalJid=${resolution.canonicalJid ?? '(none)'} canonicalPhone=${resolution.canonicalNumber ?? '(none)'} finalSendTarget=(none) source=${resolution.source ?? 'none'} safeToSend=false reason=${resolution.reason ?? 'canonical_target_not_found'}`,
      );
      throw new BadRequestException(
        resolution.reason ??
          `No se encontró un destino válido para este chat. remoteJid original=${rawRemoteJid}`,
      );
    }

    const recipient = {
      chatJid: resolution.chatRemoteJid,
      replyJid: resolution.outboundRemoteJid,
      number: resolution.finalSendTarget,
      canonicalJid: resolution.canonicalJid,
      canonicalNumber: resolution.canonicalNumber,
    };

    console.log('CHAT REMOTE JID:', recipient.chatJid);
    console.log('OUTBOUND:', recipient.replyJid);
    console.log('OUTBOUND TARGET:', recipient.number);

    this.logger.log(
      `[BOT SEND RESOLUTION] companyId=${companyId} remoteJidOriginal=${rawRemoteJid} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} canonicalJid=${recipient.canonicalJid ?? '(none)'} canonicalPhone=${recipient.canonicalNumber ?? '(none)'} finalSendTarget=${recipient.number} outboundRemoteJid=${recipient.replyJid} source=${resolution.source} safeToSend=true`,
    );
    const evolutionPayload: Record<string, unknown> = {
      number: recipient.number,
      text: payload.text.trim(),
      ...(payload.quotedMessageId ? { quoted: { key: { id: payload.quotedMessageId } } } : {}),
    };

    this.logger.log(
      `[WHATSAPP OUTBOUND] preparing send companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} rawRemoteJid=${rawRemoteJid} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} outboundRemoteJid=${recipient.replyJid} finalSendTarget=${recipient.number} messageLength=${payload.text?.trim().length ?? 0}`,
    );
    this.logger.log(
      `[WHATSAPP OUTBOUND] send payload instanceName=${config.instanceName} endpoint=/message/sendText payload=${JSON.stringify(evolutionPayload)}`,
    );

    let response: Record<string, unknown>;
    try {
      response = await this.evolutionApiClient.sendText(config, evolutionPayload);
    } catch (error) {
      this.logger.error(
        `[WHATSAPP OUTBOUND] send failed companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} rawRemoteJid=${rawRemoteJid} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} outboundRemoteJid=${recipient.replyJid} finalSendTarget=${recipient.number} error=${this.formatErrorForLog(error)}`,
      );
      throw error;
    }

    this.logger.log(
      `[WHATSAPP OUTBOUND] send success instanceName=${config.instanceName} endpoint=/message/sendText response=${this.safeJsonForLog(response)}`,
    );

    const chat = await this.findOrCreateChat(config, recipient.chatJid, undefined, recipient.canonicalJid);
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
      durationSeconds: null,
      rawPayloadJson: response,
    });

    return { message: await this.toMessageView(message), evolution: response };
  }

  async sendMedia(companyId: string, payload: SendWhatsappMediaDto): Promise<Record<string, unknown>> {
    const normalizedJid = this.jidResolver.normalizeRemoteJid(payload.remoteJid, { throwOnEmpty: true });
    const config = await this.resolveOutboundConfig(companyId, normalizedJid);
    const outboundMedia = await this.resolveOutboundMedia(companyId, payload.attachmentId, payload.mediaUrl);

    const resolution = await this.diagnoseRecipientResolution(companyId, normalizedJid);
    if (!resolution.safeToSend || !resolution.finalSendTarget || !resolution.outboundRemoteJid || !resolution.chatRemoteJid) {
      this.logger.warn(
        `[BOT SEND RESOLUTION] companyId=${companyId} remoteJidOriginal=${payload.remoteJid} normalizedRemoteJid=${normalizedJid} canonicalJid=${resolution.canonicalJid ?? '(none)'} canonicalPhone=${resolution.canonicalNumber ?? '(none)'} finalSendTarget=(none) source=${resolution.source ?? 'none'} safeToSend=false reason=${resolution.reason ?? 'canonical_target_not_found'}`,
      );
      throw new BadRequestException(
        resolution.reason ??
          `No se encontró un destino válido para este chat. remoteJid original=${payload.remoteJid}`,
      );
    }

    const recipient = {
      chatJid: resolution.chatRemoteJid,
      replyJid: resolution.outboundRemoteJid,
      number: resolution.finalSendTarget,
      canonicalJid: resolution.canonicalJid,
      canonicalNumber: resolution.canonicalNumber,
    };

    console.log('CHAT REMOTE JID:', recipient.chatJid);
    console.log('OUTBOUND:', recipient.replyJid);
    console.log('OUTBOUND TARGET:', recipient.number);

    this.logger.log(
      `[BOT SEND RESOLUTION] companyId=${companyId} remoteJidOriginal=${payload.remoteJid} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} canonicalJid=${recipient.canonicalJid ?? '(none)'} canonicalPhone=${recipient.canonicalNumber ?? '(none)'} finalSendTarget=${recipient.number} outboundRemoteJid=${recipient.replyJid} source=${resolution.source} safeToSend=true`,
    );

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
      `[WHATSAPP OUTBOUND] preparing send companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} outboundRemoteJid=${recipient.replyJid} finalSendTarget=${recipient.number} mediaType=${payload.mediaType}`,
    );
    this.logger.log(
      `[WHATSAPP OUTBOUND] send payload instanceName=${config.instanceName} endpoint=/message/sendMedia payload=${this.safeJsonForLog(evolutionPayload)}`,
    );

    let response: Record<string, unknown>;
    try {
      response = await this.evolutionApiClient.sendMedia(config, evolutionPayload);
    } catch (error) {
      this.logger.error(
        `[WHATSAPP OUTBOUND] send failed companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} outboundRemoteJid=${recipient.replyJid} finalSendTarget=${recipient.number} mediaType=${payload.mediaType} error=${this.formatErrorForLog(error)}`,
      );
      throw error;
    }

    this.logger.log(
      `[WHATSAPP OUTBOUND] send success instanceName=${config.instanceName} endpoint=/message/sendMedia response=${this.safeJsonForLog(response)}`,
    );

    const chat = await this.findOrCreateChat(config, recipient.chatJid, undefined, recipient.canonicalJid);
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
      thumbnailUrl:
        payload.mediaType === 'image'
          ? outboundMedia.storagePath
          : outboundMedia.thumbnailStoragePath,
      durationSeconds: outboundMedia.durationSeconds,
      rawPayloadJson: response,
    });

    if (payload.attachmentId) {
      await this.attachmentsService.bindToMessage(payload.attachmentId, message.id);
    }

    return { message: await this.toMessageView(message), evolution: response };
  }

  async sendAudio(companyId: string, payload: SendWhatsappAudioDto): Promise<Record<string, unknown>> {
    const normalizedJid = this.jidResolver.normalizeRemoteJid(payload.remoteJid, { throwOnEmpty: true });
    const config = await this.resolveOutboundConfig(companyId, normalizedJid);
    const outboundMedia = await this.resolveOutboundMedia(companyId, payload.attachmentId, payload.audioUrl);

    const resolution = await this.diagnoseRecipientResolution(companyId, normalizedJid);
    if (!resolution.safeToSend || !resolution.finalSendTarget || !resolution.outboundRemoteJid || !resolution.chatRemoteJid) {
      this.logger.warn(
        `[BOT SEND RESOLUTION] companyId=${companyId} remoteJidOriginal=${payload.remoteJid} normalizedRemoteJid=${normalizedJid} canonicalJid=${resolution.canonicalJid ?? '(none)'} canonicalPhone=${resolution.canonicalNumber ?? '(none)'} finalSendTarget=(none) source=${resolution.source ?? 'none'} safeToSend=false reason=${resolution.reason ?? 'canonical_target_not_found'}`,
      );
      throw new BadRequestException(
        resolution.reason ??
          `No se encontró un destino válido para este chat. remoteJid original=${payload.remoteJid}`,
      );
    }

    const recipient = {
      chatJid: resolution.chatRemoteJid,
      replyJid: resolution.outboundRemoteJid,
      number: resolution.finalSendTarget,
      canonicalJid: resolution.canonicalJid,
      canonicalNumber: resolution.canonicalNumber,
    };

    console.log('CHAT REMOTE JID:', recipient.chatJid);
    console.log('OUTBOUND:', recipient.replyJid);
    console.log('OUTBOUND TARGET:', recipient.number);

    this.logger.log(
      `[BOT SEND RESOLUTION] companyId=${companyId} remoteJidOriginal=${payload.remoteJid} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} canonicalJid=${recipient.canonicalJid ?? '(none)'} canonicalPhone=${recipient.canonicalNumber ?? '(none)'} finalSendTarget=${recipient.number} outboundRemoteJid=${recipient.replyJid} source=${resolution.source} safeToSend=true`,
    );

    const evolutionPayload: Record<string, unknown> = {
      number: recipient.number,
      audio: outboundMedia.url,
      ...(payload.quotedMessageId ? { quoted: { key: { id: payload.quotedMessageId } } } : {}),
    };

    this.logger.log(
      `[WHATSAPP OUTBOUND] preparing send companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} outboundRemoteJid=${recipient.replyJid} finalSendTarget=${recipient.number} mediaType=audio`,
    );
    this.logger.log(
      `[WHATSAPP OUTBOUND] send payload instanceName=${config.instanceName} endpoint=/message/sendWhatsAppAudio payload=${this.safeJsonForLog(evolutionPayload)}`,
    );

    let response: Record<string, unknown>;
    try {
      response = await this.evolutionApiClient.sendWhatsAppAudio(config, evolutionPayload);
    } catch (error) {
      this.logger.error(
        `[WHATSAPP OUTBOUND] send failed companyId=${companyId} channelConfigId=${config.id} instanceName=${config.instanceName} normalizedRemoteJid=${normalizedJid} chatRemoteJid=${recipient.chatJid} outboundRemoteJid=${recipient.replyJid} finalSendTarget=${recipient.number} mediaType=audio error=${this.formatErrorForLog(error)}`,
      );
      throw error;
    }

    this.logger.log(
      `[WHATSAPP OUTBOUND] send success instanceName=${config.instanceName} endpoint=/message/sendWhatsAppAudio response=${this.safeJsonForLog(response)}`,
    );

    const chat = await this.findOrCreateChat(config, recipient.chatJid, undefined, recipient.canonicalJid);
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
      durationSeconds: payload.durationSeconds ?? outboundMedia.durationSeconds,
      rawPayloadJson: response,
    });

    if (payload.attachmentId) {
      await this.attachmentsService.bindToMessage(payload.attachmentId, message.id);
    }

    return { message: await this.toMessageView(message), evolution: response };
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
    const normalizedJid = this.jidResolver.normalizeRemoteJid(remoteJid, { throwOnEmpty: true });
    const chat = await this.chatsRepository.findOne({ where: { companyId, remoteJid: normalizedJid } });
    if (!chat) {
      return [];
    }

    const messages = await this.messagesRepository.find({
      where: { companyId, chatId: chat.id },
      order: { createdAt: 'ASC' },
      take: 500,
    });

    return Promise.all(messages.map((message) => this.toMessageView(message)));
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
    params: {
      mediaStoragePath: string;
      mediaSizeBytes: string | null;
      mimeType?: string | null;
      mediaUrl?: string | null;
      thumbnailUrl?: string | null;
      durationSeconds?: number | null;
    },
  ): Promise<WhatsappMessageEntity> {
    const message = await this.messagesRepository.findOne({ where: { id: messageId, companyId } });
    if (!message) {
      throw new NotFoundException('Mensaje no encontrado.');
    }

    message.mediaStoragePath = params.mediaStoragePath;
    message.mediaSizeBytes = params.mediaSizeBytes;
    if (params.mimeType !== undefined) {
      message.mimeType = params.mimeType;
    }
    if (params.mediaUrl !== undefined) {
      message.mediaUrl = params.mediaUrl;
    }
    if (params.thumbnailUrl !== undefined) {
      message.thumbnailUrl = params.thumbnailUrl;
    }
    if (params.durationSeconds !== undefined) {
      message.durationSeconds = params.durationSeconds;
    }
    return this.messagesRepository.save(message);
  }

  async findOrCreateChat(
    config: WhatsappChannelConfigEntity,
    remoteJid: string,
    pushName?: string | null,
    canonicalRemoteJid?: string | null,
    rawRemoteJid?: string | null,
    lastInboundJidType?: string | null,
    replyTargetUnresolved?: boolean,
  ): Promise<WhatsappChatEntity> {
    const existing = await this.chatsRepository.findOne({
      where: { companyId: config.companyId, remoteJid },
    });

    if (existing) {
      if (pushName && !existing.pushName) {
        existing.pushName = pushName;
      }

      const normalizedCanonical = this.jidResolver.normalizeCanonicalRemoteJid(canonicalRemoteJid);
      if (normalizedCanonical && existing.canonicalRemoteJid !== normalizedCanonical) {
        existing.canonicalRemoteJid = normalizedCanonical;
        existing.canonicalNumber = this.jidResolver.normalizeOutboundNumber(this.jidResolver.jidToNumber(normalizedCanonical));
        existing.replyTargetUnresolved = false;
      }

      const derivedSendTarget = this.extractPhoneFromRemoteJid(existing.remoteJid);
      if (derivedSendTarget) {
        existing.sendTarget = derivedSendTarget;
      }

      if (rawRemoteJid && (!existing.rawRemoteJid || existing.rawRemoteJid !== rawRemoteJid)) {
        existing.rawRemoteJid = rawRemoteJid;
      }
      if (!existing.originalRemoteJid) {
        existing.originalRemoteJid = remoteJid;
      }
      if (lastInboundJidType) {
        existing.lastInboundJidType = lastInboundJidType;
      }
      if (replyTargetUnresolved !== undefined) {
        existing.replyTargetUnresolved = replyTargetUnresolved;
      }

      this.logger.log(
        `[CHAT TARGET PERSISTENCE] companyId=${config.companyId} chatId=${existing.id} remoteJid=${existing.remoteJid} originalRemoteJid=${existing.originalRemoteJid ?? '(none)'} rawRemoteJid=${existing.rawRemoteJid ?? '(none)'} canonicalJid=${existing.canonicalRemoteJid ?? '(none)'} canonicalNumber=${existing.canonicalNumber ?? '(none)'} sendTarget=${existing.sendTarget ?? '(none)'} lastInboundJidType=${existing.lastInboundJidType ?? '(none)'} replyTargetUnresolved=${existing.replyTargetUnresolved}`,
      );

      return this.chatsRepository.save(existing);
    }

    const normalizedCanonical = this.jidResolver.normalizeCanonicalRemoteJid(canonicalRemoteJid);
    const canonicalNumber = normalizedCanonical
      ? this.jidResolver.normalizeOutboundNumber(this.jidResolver.jidToNumber(normalizedCanonical))
      : (remoteJid.endsWith('@s.whatsapp.net')
          ? this.jidResolver.normalizeOutboundNumber(this.jidResolver.jidToNumber(remoteJid))
          : null);
    const derivedSendTarget = this.extractPhoneFromRemoteJid(remoteJid);

    const entity = this.chatsRepository.create({
      companyId: config.companyId,
      channelConfigId: config.id,
      remoteJid,
      originalRemoteJid: remoteJid,
      rawRemoteJid: rawRemoteJid ?? remoteJid,
      canonicalRemoteJid: normalizedCanonical,
      canonicalNumber,
      sendTarget: derivedSendTarget,
      lastInboundJidType: lastInboundJidType ?? this.jidResolver.detectJidType(remoteJid),
      replyTargetUnresolved: replyTargetUnresolved ?? (remoteJid.endsWith('@lid') && !normalizedCanonical),
      pushName: pushName ?? null,
      profileName: null,
      profilePictureUrl: null,
      lastMessageAt: null,
      unreadCount: 0,
    });

    const saved = await this.chatsRepository.save(entity);
    this.logger.log(
      `[CHAT TARGET PERSISTENCE] companyId=${config.companyId} chatId=${saved.id} remoteJid=${saved.remoteJid} originalRemoteJid=${saved.originalRemoteJid ?? '(none)'} rawRemoteJid=${saved.rawRemoteJid ?? '(none)'} canonicalJid=${saved.canonicalRemoteJid ?? '(none)'} canonicalNumber=${saved.canonicalNumber ?? '(none)'} sendTarget=${saved.sendTarget ?? '(none)'} lastInboundJidType=${saved.lastInboundJidType ?? '(none)'} replyTargetUnresolved=${saved.replyTargetUnresolved}`,
    );
    return saved;
  }

  async upsertInboundMessage(params: {
    companyId: string;
    config: WhatsappChannelConfigEntity;
    remoteJid: string;
    canonicalRemoteJid?: string | null;
    rawRemoteJid?: string | null;
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
    durationSeconds: number | null;
    rawPayloadJson: Record<string, unknown>;
    status?: string;
  }): Promise<WhatsappMessageEntity> {
    const normalizedStatus = this.normalizeMessageStatus(params.status, params.fromMe);

    if (params.evolutionMessageId) {
      const existing = await this.messagesRepository.findOne({
        where: { companyId: params.companyId, evolutionMessageId: params.evolutionMessageId },
      });
      if (existing) {
        existing.status = normalizedStatus ?? existing.status;
        existing.rawPayloadJson = params.rawPayloadJson;
        this.applyMessageStatusTimestamps(existing, existing.status);
        return this.messagesRepository.save(existing);
      }
    }

    const chat = await this.findOrCreateChat(
      params.config,
      params.remoteJid,
      params.pushName,
      params.canonicalRemoteJid,
      params.rawRemoteJid,
      this.jidResolver.detectJidType(params.remoteJid),
      params.remoteJid.endsWith('@lid') && !this.jidResolver.normalizeCanonicalRemoteJid(params.canonicalRemoteJid),
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
      durationSeconds: params.durationSeconds,
      rawPayloadJson: params.rawPayloadJson,
      status: normalizedStatus ?? (params.fromMe ? 'sent' : 'received'),
      sentAt: params.fromMe ? new Date() : null,
      deliveredAt: null,
      readAt: null,
    });

    this.applyMessageStatusTimestamps(entity, entity.status);

    return this.messagesRepository.save(entity);
  }

  async applyStatusUpdate(params: {
    companyId: string;
    evolutionMessageId: string | null;
    status?: unknown;
    fromMe?: boolean | null;
    rawPayloadJson: Record<string, unknown>;
  }): Promise<WhatsappMessageEntity | null> {
    const evolutionMessageId = this.readString(params.evolutionMessageId);
    if (!evolutionMessageId) {
      return null;
    }

    const existing = await this.messagesRepository.findOne({
      where: { companyId: params.companyId, evolutionMessageId },
    });
    if (!existing) {
      return null;
    }

    const normalizedStatus = this.normalizeMessageStatus(
      params.status,
      existing.fromMe || params.fromMe === true,
    );

    existing.rawPayloadJson = params.rawPayloadJson;
    if (normalizedStatus) {
      existing.status = this.mergeMessageStatus(existing.status, normalizedStatus);
      this.applyMessageStatusTimestamps(existing, existing.status);
    }

    return this.messagesRepository.save(existing);
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
    durationSeconds: number | null;
    rawPayloadJson: Record<string, unknown>;
  }): Promise<WhatsappMessageEntity> {
    params.chat.lastMessageAt = new Date();
    await this.chatsRepository.save(params.chat);

    const key = this.readMap(params.response['key']);
    const normalizedStatus = this.normalizeMessageStatus(this.readString(params.response['status']), true);
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
      durationSeconds: params.durationSeconds,
      rawPayloadJson: params.rawPayloadJson,
      status: normalizedStatus ?? 'sent',
      sentAt: new Date(),
      deliveredAt: null,
      readAt: null,
    });

    this.applyMessageStatusTimestamps(entity, entity.status);

    return this.messagesRepository.save(entity);
  }

  private async resolveOutboundMedia(
    companyId: string,
    attachmentId?: string,
    directUrl?: string,
  ): Promise<{
    url: string;
    mimeType: string | null;
    fileName: string;
    storagePath: string | null;
    sizeBytes: string | null;
    thumbnailStoragePath: string | null;
    durationSeconds: number | null;
  }> {
    if (attachmentId) {
      const attachment = await this.attachmentsService.getById(companyId, attachmentId);
      const signed = await this.storageService.presignDownload({
        companyId,
        key: attachment.storagePath,
        expiresInSeconds: 60 * 60 * 24,
      });

      return {
        url: signed.url,
        mimeType: attachment.mimeType,
        fileName: attachment.originalName ?? 'file',
        storagePath: attachment.storagePath,
        sizeBytes: attachment.sizeBytes,
        thumbnailStoragePath: this.readString(attachment.metadataJson['thumbnailStoragePath']) || null,
        durationSeconds: this.readOptionalNumber(attachment.metadataJson['durationSeconds']),
      };
    }

    if (directUrl && directUrl.trim().length > 0) {
      const sanitizedUrl = this.assertHttpMediaUrl(directUrl, 'mediaUrl/audioUrl');
      return {
        url: sanitizedUrl,
        mimeType: null,
        fileName: 'remote-file',
        storagePath: null,
        sizeBytes: null,
        thumbnailStoragePath: null,
        durationSeconds: null,
      };
    }

    throw new BadRequestException('Debes enviar attachmentId o mediaUrl/audioUrl.');
  }

  private assertHttpMediaUrl(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} es obligatorio.`);
    }

    const parsed = URL.parse(trimmed);
    if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
      throw new BadRequestException(`${fieldName} debe ser una URL HTTP/HTTPS valida.`);
    }

    return trimmed;
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

  private async resolveOutboundRecipientWithSource(
    companyId: string,
    remoteJid: string,
  ): Promise<{
    jid: string | null;
    number: string | null;
    sendTarget: string;
    chatRemoteJid: string;
    remoteJid: string;
    source: 'remoteJid' | 'chat' | 'last_inbound_payload';
  }> {
    const chat = await this.chatsRepository.findOne({ where: { companyId, remoteJid } });
    const chatRemoteJid = this.readString(chat?.remoteJid) || remoteJid;
    const outboundRemoteJid = this.jidResolver.normalizeReplyJid(chatRemoteJid, { throwOnEmpty: true });
    const sendTarget = this.extractPhoneFromRemoteJid(outboundRemoteJid);
    if (!sendTarget) {
      throw new BadRequestException(`remoteJid no contiene digitos para envío: ${outboundRemoteJid}`);
    }

    const config = await this.resolveOutboundConfig(companyId, remoteJid, chat?.channelConfigId);
    if (this.isInstanceSendTarget(config, sendTarget)) {
      const instancePhone = this.readString(config.instancePhone) || '(none)';
      this.logger.error(
        `[WHATSAPP OUTBOUND] blocked instance target companyId=${companyId} instanceName=${config.instanceName} chatRemoteJid=${chatRemoteJid} outboundRemoteJid=${outboundRemoteJid} sendTarget=${sendTarget} instancePhone=${instancePhone}`,
      );
      throw new BadRequestException(
        `Destino bloqueado: el target ${sendTarget} coincide con el numero de la instancia. chat.remoteJid=${chatRemoteJid}`,
      );
    }

    let source: 'remoteJid' | 'chat' | 'last_inbound_payload' = chat ? 'chat' : 'remoteJid';
    let canonicalJid = this.jidResolver.normalizeCanonicalRemoteJid(chat?.canonicalRemoteJid);

    if (!canonicalJid && remoteJid.endsWith('@lid')) {
      const lastInbound = await this.messagesRepository.findOne({
        where: { companyId, remoteJid, direction: 'inbound' },
        order: { createdAt: 'DESC' },
      });

      const extracted = lastInbound
        ? this.jidResolver.normalizeCanonicalRemoteJid(
            this.jidResolver.extractCanonicalRemoteJidFromPayload(lastInbound.rawPayloadJson),
          )
        : null;

      if (extracted) {
        canonicalJid = extracted;
        source = 'last_inbound_payload';

        if (chat) {
          chat.canonicalRemoteJid = extracted;
          chat.canonicalNumber = this.jidResolver.normalizeOutboundNumber(this.jidResolver.jidToNumber(extracted));
          chat.replyTargetUnresolved = false;
          await this.chatsRepository.save(chat);
        }
      }
    }

    if (!canonicalJid && remoteJid.endsWith('@s.whatsapp.net')) {
      canonicalJid = this.jidResolver.normalizeCanonicalRemoteJid(remoteJid);
    }

    const canonicalNumber = canonicalJid
      ? this.jidResolver.normalizeOutboundNumber(this.jidResolver.jidToNumber(canonicalJid))
      : null;

    return {
      jid: canonicalJid,
      number: canonicalNumber,
      sendTarget,
      chatRemoteJid,
      remoteJid: outboundRemoteJid,
      source,
    };
  }

  private extractPhoneFromRemoteJid(remoteJid: string): string {
    return this.jidResolver.extractPhoneFromJid(remoteJid.trim());
  }

  private isInstanceSendTarget(config: WhatsappChannelConfigEntity, sendTarget: string): boolean {
    const instancePhone = this.readString(config.instancePhone);
    if (!instancePhone) {
      return false;
    }

    return this.jidResolver.normalizeOutboundNumber(sendTarget) ===
      this.jidResolver.normalizeOutboundNumber(instancePhone);
  }

  private extractCanonicalRemoteJidFromPayload(payload: Record<string, unknown>): string | null {
    // Only accept phone-based JIDs. No scanning/truncation.
    const data = this.readMap(payload['data']);
    const key = this.readMap(data['key']);
    const message = this.readMap(data['message']);
    const remoteJid = this.readString(key['remoteJid']);
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

  private resolveCanonicalCandidate(value: string, disallowedDigits: Set<string> = new Set()): string | null {
    const canonicalJid = this.normalizeCanonicalRemoteJid(value);
    if (canonicalJid) {
      const canonicalDigits = this.normalizeOutboundNumber(this.jidToNumber(canonicalJid));
      if (canonicalDigits && disallowedDigits.has(canonicalDigits)) {
        return null;
      }
      return canonicalJid;
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.endsWith('@lid') || trimmed.endsWith('@g.us') || trimmed.includes('@')) {
      return null;
    }

    const digits = this.normalizeOutboundNumber(trimmed.replace(/\D/g, ''));
    if (digits.length < 10 || digits.length > 15) {
      return null;
    }
    if (disallowedDigits.has(digits)) {
      return null;
    }

    return `${digits}@s.whatsapp.net`;
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

  private async toMessageView(message: WhatsappMessageEntity): Promise<Record<string, unknown>> {
    const mediaUrl = await this.resolveMessageAssetUrl(
      message.companyId,
      message.mediaStoragePath,
      message.mediaUrl,
    );
    const thumbnailUrl = await this.resolveMessageThumbnailUrl(message, mediaUrl);

    return {
      id: message.id,
      chatId: message.chatId,
      evolutionMessageId: message.evolutionMessageId,
      remoteJid: message.remoteJid,
      fromMe: message.fromMe,
      direction: message.direction,
      type: message.messageType,
      messageType: message.messageType,
      textBody: message.textBody,
      caption: message.caption,
      mimeType: message.mimeType,
      mediaUrl,
      mediaStoragePath: message.mediaStoragePath,
      mediaOriginalName: message.mediaOriginalName,
      mediaSizeBytes: message.mediaSizeBytes,
      thumbnailUrl,
      duration: message.durationSeconds,
      status: message.status,
      sentAt: message.sentAt?.toISOString(),
      deliveredAt: message.deliveredAt?.toISOString(),
      readAt: message.readAt?.toISOString(),
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
    };
  }

  private async resolveMessageAssetUrl(
    companyId: string,
    storagePath: string | null,
    fallbackUrl: string | null,
  ): Promise<string | null> {
    if (storagePath) {
      try {
        return (
          await this.storageService.presignDownload({
            companyId,
            key: storagePath,
            expiresInSeconds: 60 * 60 * 24,
          })
        ).url;
      } catch {
        // fall back to existing URL when signing fails
      }
    }

    return this.resolveStoredUrlOrFallback(companyId, fallbackUrl);
  }

  private async resolveMessageThumbnailUrl(
    message: WhatsappMessageEntity,
    resolvedMediaUrl: string | null,
  ): Promise<string | null> {
    if (message.messageType === 'image') {
      return resolvedMediaUrl;
    }

    return this.resolveStoredUrlOrFallback(message.companyId, message.thumbnailUrl);
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

  private async resolveStoredUrlOrFallback(
    companyId: string,
    candidate: string | null,
  ): Promise<string | null> {
    const trimmed = candidate?.trim() ?? '';
    if (!trimmed) {
      return null;
    }

    if (!trimmed.startsWith(`${companyId}/`)) {
      return trimmed;
    }

    try {
      return (
        await this.storageService.presignDownload({
          companyId,
          key: trimmed,
          expiresInSeconds: 60 * 60 * 24,
        })
      ).url;
    } catch {
      return null;
    }
  }

  private normalizeMessageStatus(status: unknown, fromMe: boolean): string | null {
    if (typeof status === 'number') {
      return this.normalizeNumericAck(status, fromMe);
    }

    const normalized = this.readString(status).trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (/^\d+$/.test(normalized)) {
      return this.normalizeNumericAck(Number.parseInt(normalized, 10), fromMe);
    }

    if (normalized === 'queued' || normalized === 'pending') {
      return 'queued';
    }

    if (
      normalized === 'sent' ||
      normalized === 'server_ack' ||
      normalized === 'device_sent' ||
      normalized === 'ack'
    ) {
      return 'sent';
    }

    if (
      normalized === 'delivered' ||
      normalized === 'delivery_ack' ||
      normalized === 'delivered_ack' ||
      normalized === 'received'
    ) {
      return fromMe ? 'delivered' : 'received';
    }

    if (
      normalized === 'read' ||
      normalized === 'read_ack' ||
      normalized === 'played' ||
      normalized === 'played_ack'
    ) {
      return 'read';
    }

    if (normalized === 'failed' || normalized === 'error') {
      return 'failed';
    }

    return normalized;
  }

  private normalizeNumericAck(ack: number, fromMe: boolean): string | null {
    switch (ack) {
      case 0:
        return 'queued';
      case 1:
        return 'sent';
      case 2:
        return fromMe ? 'delivered' : 'received';
      case 3:
      case 4:
        return 'read';
      default:
        return null;
    }
  }

  private mergeMessageStatus(currentStatus: string, nextStatus: string): string {
    if (currentStatus === nextStatus) {
      return currentStatus;
    }

    const currentRank = this.messageStatusRank(currentStatus);
    const nextRank = this.messageStatusRank(nextStatus);
    if (currentRank >= 0 && nextRank >= 0) {
      return nextRank >= currentRank ? nextStatus : currentStatus;
    }

    if (currentStatus === 'failed' && nextStatus !== 'delivered' && nextStatus !== 'read') {
      return currentStatus;
    }

    return nextStatus;
  }

  private messageStatusRank(status: string): number {
    switch (status) {
      case 'queued':
        return 0;
      case 'sent':
        return 1;
      case 'delivered':
        return 2;
      case 'read':
        return 3;
      default:
        return -1;
    }
  }

  private applyMessageStatusTimestamps(message: WhatsappMessageEntity, status: string): void {
    if (!message.fromMe) {
      return;
    }

    const now = new Date();
    if (status === 'sent' && !message.sentAt) {
      message.sentAt = now;
      return;
    }

    if (status === 'delivered') {
      message.sentAt ??= now;
      message.deliveredAt ??= now;
      return;
    }

    if (status === 'read') {
      message.sentAt ??= now;
      message.deliveredAt ??= now;
      message.readAt ??= now;
    }
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

  private detectJidType(remoteJid: string): string {
    if (remoteJid.endsWith('@s.whatsapp.net')) {
      return 's.whatsapp.net';
    }
    if (remoteJid.endsWith('@lid')) {
      return 'lid';
    }
    if (remoteJid.endsWith('@g.us')) {
      return 'group';
    }
    return 'unknown';
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
