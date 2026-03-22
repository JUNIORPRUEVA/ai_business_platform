import { BadRequestException, Injectable, Logger, MessageEvent, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable } from 'rxjs';
import { Repository } from 'typeorm';
import { Readable } from 'node:stream';

import { DatabaseService } from '../../../common/database/database.service';
import { AiBrainService } from '../../ai_brain/services/ai-brain.service';
import { ClientMemoryEntity } from '../../ai_brain/entities/client-memory.entity';
import { MemoryService } from '../../ai-engine/memory.service';
import { ContactMemoryEntity } from '../../ai-engine/entities/contact-memory.entity';
import { ConversationMemoryEntity } from '../../ai-engine/entities/conversation-memory.entity';
import { ConversationSummaryEntity } from '../../ai-engine/entities/conversation-summary.entity';
import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { ChannelsService } from '../../channels/channels.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ContactEntity } from '../../contacts/entities/contact.entity';
import { ConversationsService } from '../../conversations/conversations.service';
import { ConversationEntity } from '../../conversations/entities/conversation.entity';
import { MessagesService } from '../../messages/messages.service';
import { MessageEntity } from '../../messages/entities/message.entity';
import { StorageService } from '../../storage/storage.service';
import { WhatsappChannelConfigEntity } from '../../whatsapp-channel/entities/whatsapp-channel-config.entity';
import { WhatsappChannelLogEntity } from '../../whatsapp-channel/entities/whatsapp-channel-log.entity';
import { WhatsappChatEntity } from '../../whatsapp-channel/entities/whatsapp-chat.entity';
import { WhatsappMessageEntity } from '../../whatsapp-channel/entities/whatsapp-message.entity';
import { WhatsappAttachmentService } from '../../whatsapp-channel/services/whatsapp-attachment.service';
import { BotCenterRealtimeService } from '../../whatsapp-channel/services/bot-center-realtime.service';
import { WhatsappMessagingService } from '../../whatsapp-channel/services/whatsapp-messaging.service';
import { CreateMemoryItemDto } from '../dto/create-memory-item.dto';
import { SendTestMediaDto } from '../dto/send-test-media.dto';
import { SendTestMessageDto } from '../dto/send-test-message.dto';
import { UpdateMemoryItemDto } from '../dto/update-memory-item.dto';
import { UpdatePromptDto } from '../dto/update-prompt.dto';
import {
  BotCenterOverviewResponse,
  BotContactContextResponse,
  BotConversationDetailResponse,
  BotConversationSummary,
  BotDeliveryDiagnosticsResponse,
  BotLogResponse,
  BotLogSeverity,
  BotMemoryItemResponse,
  BotMemoryResponse,
  BotMessageResponse,
  BotPromptConfigResponse,
  BotStatusCardResponse,
  BotStatusResponse,
  BotToolResponse,
  SendMediaMessageResponse,
  SendTestMessageResponse,
  ServiceHealthState,
} from '../types/bot-center.types';

@Injectable()
export class BotCenterService {
  private readonly logger = new Logger(BotCenterService.name);
  private readonly runtimeLogs: Array<BotLogResponse & { companyId: string }> = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly botConfigurationService: BotConfigurationService,
    private readonly memoryService: MemoryService,
    private readonly databaseService: DatabaseService,
    private readonly aiBrainService: AiBrainService,
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    @InjectRepository(WhatsappChannelConfigEntity)
    private readonly channelConfigsRepository: Repository<WhatsappChannelConfigEntity>,
    @InjectRepository(WhatsappChatEntity)
    private readonly chatsRepository: Repository<WhatsappChatEntity>,
    @InjectRepository(WhatsappMessageEntity)
    private readonly messagesRepository: Repository<WhatsappMessageEntity>,
    @InjectRepository(WhatsappChannelLogEntity)
    private readonly channelLogsRepository: Repository<WhatsappChannelLogEntity>,
    @InjectRepository(ConversationMemoryEntity)
    private readonly conversationMemoryRepository: Repository<ConversationMemoryEntity>,
    @InjectRepository(ContactMemoryEntity)
    private readonly contactMemoryRepository: Repository<ContactMemoryEntity>,
    @InjectRepository(ClientMemoryEntity)
    private readonly clientMemoryRepository: Repository<ClientMemoryEntity>,
    @InjectRepository(ConversationSummaryEntity)
    private readonly conversationSummaryRepository: Repository<ConversationSummaryEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactsRepository: Repository<ContactEntity>,
    @InjectRepository(ConversationEntity)
    private readonly conversationsRepository: Repository<ConversationEntity>,
    @InjectRepository(MessageEntity)
    private readonly appMessagesRepository: Repository<MessageEntity>,
    private readonly attachmentsService: WhatsappAttachmentService,
    private readonly botCenterRealtimeService: BotCenterRealtimeService,
    private readonly whatsappMessagingService: WhatsappMessagingService,
    private readonly storageService: StorageService,
  ) {}

  streamRealtimeEvents(companyId: string): Observable<MessageEvent> {
    return this.botCenterRealtimeService.streamCompanyEvents(companyId);
  }

  async getOverview(
    companyId: string,
    selectedConversationId?: string,
  ): Promise<BotCenterOverviewResponse> {
    const conversations = await this.listConversations(companyId);
    const selectedConversationTarget = selectedConversationId || conversations[0]?.id;
    const selectedConversation = selectedConversationTarget
      ? await this.getConversationDetailSafely(companyId, selectedConversationTarget)
      : undefined;

    return {
      conversations,
      tools: this.listTools(),
      logs: await this.listLogs(companyId),
      status: await this.getStatus(companyId),
      prompt: this.getPromptConfig(),
      selectedConversation,
    };
  }

  async listConversations(companyId: string): Promise<BotConversationSummary[]> {
    const chats = await this.chatsRepository.find({
      where: { companyId },
      order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
      take: 200,
    });

    const latestMessages = await this.findLatestMessages(companyId, chats.map((chat) => chat.id));
    const latestMessageByChatId = new Map(latestMessages.map((message) => [message.chatId, message]));

    return chats
      .map((chat) => this.toConversationSummary(chat, latestMessageByChatId.get(chat.id) ?? null))
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  async getConversationMessages(
    companyId: string,
    conversationId: string,
  ): Promise<BotMessageResponse[]> {
    await this.getConversationOrThrow(companyId, conversationId);

    const messages = await this.messagesRepository.find({
      where: { companyId, chatId: conversationId },
      order: { createdAt: 'ASC' },
      take: 500,
    });

    return Promise.all(messages.map((message) => this.toBotMessage(message)));
  }

  async getConversationContext(
    companyId: string,
    conversationId: string,
  ): Promise<BotContactContextResponse> {
    const chat = await this.getConversationOrThrow(companyId, conversationId);
    const lastInboundMessage = await this.messagesRepository.findOne({
      where: { companyId, chatId: conversationId, fromMe: false },
      order: { createdAt: 'DESC' },
    });

    return {
      customerName: this.resolveContactName(chat),
      phone: this.toConversationPhoneDisplay(chat),
      role: 'Contacto de WhatsApp',
      businessType: 'No identificado',
      city: 'No disponible',
      tags: [
        'WhatsApp',
        ...(chat.unreadCount > 0 ? ['Con mensajes sin leer'] : []),
        ...(lastInboundMessage?.messageType && lastInboundMessage.messageType !== 'text'
          ? [`Ultimo tipo: ${lastInboundMessage.messageType}`]
          : []),
      ],
      productKnowledge: [],
    };
  }

  async getDeliveryDiagnostics(
    companyId: string,
    conversationId: string,
  ): Promise<BotDeliveryDiagnosticsResponse> {
    const chat = await this.getConversationOrThrow(companyId, conversationId);

    const lastInbound = await this.messagesRepository.findOne({
      where: { companyId, chatId: conversationId, direction: 'inbound' },
      order: { createdAt: 'DESC' },
    });

    let resolution: BotDeliveryDiagnosticsResponse['resolution'];
    try {
      const result = await this.whatsappMessagingService.diagnoseRecipientResolution(companyId, chat.remoteJid);
      resolution = {
        canReply: result.safeToSend,
        reason: result.safeToSend ? 'ok' : (result.reason ?? 'canonical_target_not_found'),
        canonicalJid: result.canonicalJid,
        canonicalNumber: result.canonicalNumber,
        source: result.source,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      resolution = {
        canReply: false,
        reason: message,
        canonicalJid: null,
        canonicalNumber: null,
        source: null,
      };
    }

    return {
      conversationId,
      companyId,
      remoteJidOriginal: chat.remoteJid,
      stored: {
        canonicalRemoteJid: chat.canonicalRemoteJid,
        canonicalNumber: chat.canonicalNumber,
        originalRemoteJid: chat.originalRemoteJid,
        rawRemoteJid: chat.rawRemoteJid,
        sendTarget: chat.sendTarget,
        lastInboundJidType: chat.lastInboundJidType,
        replyTargetUnresolved: chat.replyTargetUnresolved,
        channelConfigId: chat.channelConfigId ?? null,
      },
      resolution,
      lastInboundMessage: {
        id: lastInbound?.id ?? null,
        createdAt: lastInbound?.createdAt?.toISOString() ?? null,
        evolutionMessageId: lastInbound?.evolutionMessageId ?? null,
        messageType: lastInbound?.messageType ?? null,
      },
      lastInboundPayloadSnapshot: lastInbound?.rawPayloadJson ?? null,
    };
  }

  async getConversationMemory(
    companyId: string,
    conversationId: string,
  ): Promise<BotMemoryResponse> {
    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, conversationId);
    if (!memoryTarget) {
      return {
        shortTerm: [],
        longTerm: [],
        operational: [],
      };
    }

    const [recentWindow, summary, longTermFacts, operationalState] = await Promise.all([
      this.memoryService.listConversationMemory(companyId, memoryTarget.conversation.id, 12),
      this.memoryService.getConversationSummary(companyId, memoryTarget.conversation.id),
      this.memoryService.listClientMemories(companyId, memoryTarget.contact.id),
      this.memoryService.listOperationalMemory(companyId, memoryTarget.contact.id),
    ]);

    return {
      shortTerm: recentWindow.map((item) => this.mapConversationMemoryItem(item)),
      longTerm: [
        ...(summary ? [this.mapSummaryMemoryItem(summary)] : []),
        ...longTermFacts.map((item) => this.mapClientMemoryItem(item)),
      ],
      operational: operationalState.map((item) => this.mapOperationalMemoryItem(item)),
    };
  }

  async createConversationMemory(
    companyId: string,
    conversationId: string,
    payload: CreateMemoryItemDto,
  ): Promise<BotMemoryItemResponse> {
    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, conversationId);
    if (!memoryTarget) {
      throw new BadRequestException(
        'No existe un canal conversacional enlazado para esta conversación de WhatsApp.',
      );
    }

    const item = await this.memoryService.createManualMemory({
      companyId,
      contactId: memoryTarget.contact.id,
      conversationId: memoryTarget.conversation.id,
      type: payload.type,
      title: payload.title,
      content: payload.content,
    });

    this.prependLog(companyId, {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Memory created',
      summary: `Se agrego una nota ${payload.type} desde Bot Center.`,
      severity: 'info',
      conversationId,
    });

    return this.mapManualMemoryItem(item);
  }

  async updateConversationMemory(
    companyId: string,
    conversationId: string,
    memoryId: string,
    payload: UpdateMemoryItemDto,
  ): Promise<BotMemoryItemResponse> {
    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, conversationId);
    if (!memoryTarget) {
      throw new BadRequestException(
        'No existe un canal conversacional enlazado para esta conversación de WhatsApp.',
      );
    }

    const item = await this.memoryService.updateManualMemory({
      companyId,
      contactId: memoryTarget.contact.id,
      conversationId: memoryTarget.conversation.id,
      memoryId,
      type: payload.type,
      title: payload.title,
      content: payload.content,
    });

    this.prependLog(companyId, {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Memory updated',
      summary: 'Se actualizo una nota manual desde Bot Center.',
      severity: 'info',
      conversationId,
    });

    return this.mapManualMemoryItem(item);
  }

  async deleteConversationMemory(
    companyId: string,
    conversationId: string,
    memoryId: string,
  ): Promise<{ deleted: true }> {
    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, conversationId);
    if (!memoryTarget) {
      throw new BadRequestException(
        'No existe un canal conversacional enlazado para esta conversación de WhatsApp.',
      );
    }

    await this.memoryService.deleteManualMemory({
      companyId,
      contactId: memoryTarget.contact.id,
      conversationId: memoryTarget.conversation.id,
      memoryId,
    });

    this.prependLog(companyId, {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Memory deleted',
      summary: 'Se elimino una nota manual desde Bot Center.',
      severity: 'warning',
      conversationId,
    });

    return { deleted: true };
  }

  listTools(): BotToolResponse[] {
    return [
      {
        id: 'tool-whatsapp-send',
        name: 'WhatsApp sender',
        description: 'Despacha mensajes salientes por Evolution API con control multiempresa.',
        category: 'channel',
        active: true,
      },
      {
        id: 'tool-webhook-ingest',
        name: 'Webhook ingest',
        description: 'Procesa eventos entrantes de Evolution de forma asincrona.',
        category: 'orchestration',
        active: true,
      },
      {
        id: 'tool-media-storage',
        name: 'Media storage',
        description: 'Persiste adjuntos en storage S3-compatible.',
        category: 'storage',
        active: true,
      },
      {
        id: 'tool-bot-memory',
        name: 'Bot memory',
        description: 'Usa memoria persistente en PostgreSQL con cache e idempotencia en Redis.',
        category: 'memory',
        active: true,
      },
    ];
  }

  async listLogs(companyId: string): Promise<BotLogResponse[]> {
    const [channelLogs, chats] = await Promise.all([
      this.channelLogsRepository.find({
        where: { companyId },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
      this.chatsRepository.find({ where: { companyId } }),
    ]);

    const chatIdByJid = new Map(chats.map((chat) => [chat.remoteJid, chat.id]));
    const runtimeLogs = this.runtimeLogs.filter((item) => item.companyId === companyId);

    return [
      ...runtimeLogs.map(({ companyId: _companyId, ...log }) => ({ ...log })),
      ...channelLogs.map((log) => this.toBotLog(log, chatIdByJid)),
    ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  async getStatus(companyId: string): Promise<BotStatusResponse> {
    const configuration = this.botConfigurationService.getConfiguration();
    const databaseHealth = this.databaseService.getHealth();
    const openAiConfigured =
      Boolean(configuration.openai.apiKey) && !configuration.openai.apiKey.includes('*');
    const [
      conversationCount,
      messageCount,
      failedChannelCalls,
      conversationMemoryCount,
      contactMemoryCount,
      clientMemoryCount,
      summaryCount,
    ] = await Promise.all([
      this.chatsRepository.count({ where: { companyId } }),
      this.messagesRepository.count({ where: { companyId } }),
      this.channelLogsRepository.count({ where: { companyId, success: false } }),
      this.conversationMemoryRepository.count({ where: { companyId } }),
      this.contactMemoryRepository.count({ where: { companyId } }),
      this.clientMemoryRepository.count({ where: { companyId } }),
      this.conversationSummaryRepository.count({ where: { companyId } }),
    ]);
    const totalMemoryRecords =
      conversationMemoryCount + contactMemoryCount + clientMemoryCount + summaryCount;

    return {
      connectedChannel: this.buildStatusCard(
        'Connected Channel',
        conversationCount > 0 ? `${conversationCount} chats activos` : 'Sin chats sincronizados',
        conversationCount > 0
          ? 'El canal de WhatsApp ya tiene conversaciones persistidas listas para operacion.'
          : 'Todavia no hay conversaciones persistidas desde Evolution API para esta empresa.',
        conversationCount > 0 ? 'healthy' : 'degraded',
      ),
      aiStatus: this.buildStatusCard(
        'AI Status',
        openAiConfigured ? 'Credentials Loaded' : 'Mock Fallback',
        openAiConfigured
          ? 'OpenAI puede generar respuestas reales cuando la orquestacion lo seleccione.'
          : 'OpenAI no esta configurado o esta enmascarado, por lo que se usa fallback.',
        openAiConfigured ? 'healthy' : 'degraded',
      ),
      backendStatus: this.buildStatusCard(
        'Backend Status',
        'NestJS Runnable',
        'La API principal, colas, storage y canales estan registrados y compilando.',
        'healthy',
      ),
      databaseStatus: this.buildStatusCard(
        'Database Status',
        databaseHealth.persistenceMode === 'postgres' ? 'PostgreSQL Mode' : 'Fallback Mode',
        `Persistence mode actual: ${databaseHealth.persistenceMode}.`,
        databaseHealth.configured ? 'healthy' : 'degraded',
      ),
      memoryStatus: this.buildStatusCard(
        'Memory Status',
        `${totalMemoryRecords} registros / ${messageCount} mensajes`,
        `Memoria conversacional: ${conversationMemoryCount}. Estado operacional: ${contactMemoryCount}. Hechos del cliente: ${clientMemoryCount}. Resumenes: ${summaryCount}. Mensajes WhatsApp persistidos: ${messageCount}. Fallos recientes del canal: ${failedChannelCalls}.`,
        configuration.memory.usePostgreSql && failedChannelCalls === 0 ? 'healthy' : 'degraded',
      ),
    };
  }

  getPromptConfig(): BotPromptConfigResponse {
    const prompt = this.botConfigurationService.getActivePrompt();
    return {
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      content: prompt.content,
      updatedAt: prompt.updatedAt,
    };
  }

  async updatePromptConfig(payload: UpdatePromptDto): Promise<BotPromptConfigResponse> {
    const currentPrompt = this.botConfigurationService.getActivePrompt();
    const updated = await this.botConfigurationService.updatePrompt(currentPrompt.id, {
      title: payload.title,
      description: payload.description,
      content: payload.content,
    });

    this.prependLog('global', {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Prompt updated',
      summary: 'La configuracion del prompt se actualizo desde Bot Center.',
      severity: 'info',
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      content: updated.content,
      updatedAt: updated.updatedAt,
    };
  }

  async sendTestMessage(
    companyId: string,
    payload: SendTestMessageDto,
  ): Promise<SendTestMessageResponse> {
    this.logger.log(
      `[BOT CENTER] sendTestMessage companyId=${companyId} conversationId=${payload.conversationId} messageLength=${payload.message?.length ?? 0}`,
    );
    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, payload.conversationId);
    const conversation = memoryTarget?.chat ?? await this.getConversationOrThrow(companyId, payload.conversationId);
    const dispatchedAt = new Date().toISOString();

    const resolution = await this.whatsappMessagingService.diagnoseRecipientResolution(
      companyId,
      conversation.remoteJid,
    );

    this.logger.log(
      `[BOT SEND RESOLUTION] companyId=${companyId} conversationId=${payload.conversationId} remoteJidOriginal=${conversation.remoteJid} canonicalJid=${resolution.canonicalJid ?? '(none)'} canonicalPhone=${resolution.canonicalNumber ?? '(none)'} finalSendTarget=${resolution.finalSendTarget ?? '(none)'} outboundRemoteJid=${resolution.outboundRemoteJid ?? '(none)'} source=${resolution.source ?? 'none'} safeToSend=${resolution.safeToSend} reason=${resolution.reason ?? 'ok'}`,
    );

    if (!resolution.safeToSend) {
      throw new BadRequestException(
        resolution.reason ??
          `No se encontró destinatario canónico para este chat. remoteJid original=${conversation.remoteJid} companyId=${companyId} conversationId=${payload.conversationId}`,
      );
    }

    const outboundDispatch = await this.whatsappMessagingService.sendText(companyId, {
      channelConfigId: conversation.channelConfigId,
      remoteJid: conversation.remoteJid,
      text: payload.message,
    });

    const outboundMessageId = this.readString(this.readMap(outboundDispatch['message'])['id']);
    const persistedOutbound = outboundMessageId
      ? await this.messagesRepository.findOne({ where: { id: outboundMessageId, companyId } })
      : null;

    this.logger.log(
      `[BOT CENTER] sendTestMessage accepted companyId=${companyId} conversationId=${payload.conversationId} storedMessageId=${persistedOutbound?.id ?? '(none)'}`,
    );

    if (memoryTarget) {
      await this.memoryService.appendConversationMemory({
        companyId,
        contactId: memoryTarget.contact.id,
        conversationId: memoryTarget.conversation.id,
        role: 'assistant',
        content: payload.message,
        contentType: 'text',
        metadataJson: {
          source: 'bot-center-send-message',
          remoteJid: conversation.remoteJid,
        },
        source: 'bot_center_outbound',
        dedupeAgainstLast: false,
      });
    }

    this.prependLog(companyId, {
      id: `log-${Date.now() + 1}`,
      timestamp: dispatchedAt,
      eventType: 'Message dispatched',
      summary: `Se envio un mensaje desde Bot Center a ${this.toPhoneDisplay(conversation.remoteJid)}.`,
      severity: 'info',
      conversationId: payload.conversationId,
    });

    if (persistedOutbound) {
      await this.botCenterRealtimeService.publishMessageUpsert(persistedOutbound);
    }

    return {
      success: true,
      conversationId: payload.conversationId,
      message: 'Mensaje enviado correctamente por el canal de WhatsApp.',
      dispatchedAt,
      status: 'accepted',
      ...(persistedOutbound ? { outboundMessage: await this.toBotMessage(persistedOutbound) } : {}),
    };
  }

  async uploadConversationMedia(
    companyId: string,
    conversationId: string,
    params: {
      buffer: Buffer;
      originalName: string;
      mimeType?: string;
      fileType: string;
    },
  ): Promise<{ attachmentId: string; mimeType: string | null; fileName: string | null; duration: number | null }> {
    await this.getConversationOrThrow(companyId, conversationId);

    const attachment = await this.attachmentsService.uploadManual({
      companyId,
      conversationId,
      buffer: params.buffer,
      originalName: params.originalName,
      mimeType: params.mimeType,
      fileType: params.fileType,
    });

    return {
      attachmentId: attachment.id,
      mimeType: attachment.mimeType,
      fileName: attachment.originalName,
      duration: this.readOptionalNumber(attachment.metadataJson['durationSeconds']),
    };
  }

  async sendMediaMessage(
    companyId: string,
    payload: SendTestMediaDto,
  ): Promise<SendMediaMessageResponse> {
    const conversation = await this.getConversationOrThrow(companyId, payload.conversationId);
    const dispatchedAt = new Date().toISOString();

    const outboundDispatch = payload.mediaType === 'audio'
      ? await this.whatsappMessagingService.sendAudio(companyId, {
          remoteJid: conversation.remoteJid,
          attachmentId: payload.attachmentId,
          quotedMessageId: undefined,
          durationSeconds: payload.duration,
        })
      : await this.whatsappMessagingService.sendMedia(companyId, {
          remoteJid: conversation.remoteJid,
          attachmentId: payload.attachmentId,
          mediaType: payload.mediaType,
          mimeType: payload.mimeType,
          fileName: payload.fileName,
          caption: payload.caption,
        });

    const outboundMessageId = this.readString(this.readMap(outboundDispatch['message'])['id']);
    const persistedOutbound = outboundMessageId
      ? await this.messagesRepository.findOne({ where: { id: outboundMessageId, companyId } })
      : null;

    this.prependLog(companyId, {
      id: `log-${Date.now() + 3}`,
      timestamp: dispatchedAt,
      eventType: 'Media dispatched',
      summary: `Se envio un ${payload.mediaType} desde Bot Center a ${this.toPhoneDisplay(conversation.remoteJid)}.`,
      severity: 'info',
      conversationId: payload.conversationId,
    });

    if (persistedOutbound) {
      await this.botCenterRealtimeService.publishMessageUpsert(persistedOutbound);
    }

    return {
      success: true,
      conversationId: payload.conversationId,
      message: 'Archivo enviado correctamente por el canal de WhatsApp.',
      dispatchedAt,
      status: 'accepted',
      ...(persistedOutbound ? { outboundMessage: await this.toBotMessage(persistedOutbound) } : {}),
    };
  }

  async downloadMessageAsset(
    companyId: string,
    conversationId: string,
    messageId: string,
    variant: 'media' | 'thumbnail',
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string }> {
    await this.getConversationOrThrow(companyId, conversationId);

    const message = await this.messagesRepository.findOne({
      where: { id: messageId, companyId, chatId: conversationId },
    });
    if (!message) {
      throw new NotFoundException('Mensaje no encontrado.');
    }

    const asset = await this.resolveMessageAssetBuffer(companyId, message, variant);
    if (!asset || !asset.buffer.length) {
      throw new NotFoundException('No se encontró el recurso solicitado para este mensaje.');
    }

    return {
      buffer: asset.buffer,
      contentType: asset.contentType,
      fileName: asset.fileName,
    };
  }

  async processDraftWithAi(
    companyId: string,
    payload: SendTestMessageDto,
  ): Promise<{ ok: true; queued: false; messageId: string }> {
    this.logger.log(
      `[BOT CENTER] processDraftWithAi companyId=${companyId} conversationId=${payload.conversationId} messageLength=${payload.message?.length ?? 0}`,
    );

    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, payload.conversationId);
    if (!memoryTarget) {
      throw new BadRequestException(
        'No existe un canal conversacional enlazado para esta conversacion de WhatsApp.',
      );
    }

    const createdMessage = await this.messagesService.create(
      companyId,
      memoryTarget.conversation.id,
      {
        sender: 'client',
        content: payload.message,
        type: 'text',
        metadata: {
          source: 'manual-ai-brain-process',
          botCenterConversationId: payload.conversationId,
          remoteJid: memoryTarget.chat.remoteJid,
        },
      },
    );

    await this.aiBrainService.processInboundMessage({
      companyId,
      channelId: memoryTarget.conversation.channelId,
      conversationId: memoryTarget.conversation.id,
      contactPhone: this.resolveConversationContactPhone(memoryTarget.chat),
      messageId: createdMessage.id,
    });

    this.prependLog(companyId, {
      id: `log-${Date.now() + 2}`,
      timestamp: new Date().toISOString(),
      eventType: 'AI draft processed',
      summary: 'Se ejecuto el cerebro IA desde Bot Center.',
      severity: 'info',
      conversationId: payload.conversationId,
    });

    return { ok: true, queued: false, messageId: createdMessage.id };
  }

  async deleteConversation(companyId: string, conversationId: string): Promise<{ deleted: true }> {
    const chat = await this.getConversationOrThrow(companyId, conversationId);
    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, conversationId);

    if (memoryTarget) {
      const contactId = memoryTarget.contact.id;
      const relatedConversations = await this.conversationsRepository.find({
        where: { companyId, contactId },
      });
      const relatedConversationIds = relatedConversations.map((item) => item.id);

      if (relatedConversationIds.length > 0) {
        await this.appMessagesRepository
          .createQueryBuilder()
          .delete()
          .where('conversation_id IN (:...conversationIds)', {
            conversationIds: relatedConversationIds,
          })
          .execute();
        await this.conversationMemoryRepository
          .createQueryBuilder()
          .delete()
          .where('company_id = :companyId', { companyId })
          .andWhere('conversation_id IN (:...conversationIds)', {
            conversationIds: relatedConversationIds,
          })
          .execute();
        await this.conversationSummaryRepository
          .createQueryBuilder()
          .delete()
          .where('company_id = :companyId', { companyId })
          .andWhere('conversation_id IN (:...conversationIds)', {
            conversationIds: relatedConversationIds,
          })
          .execute();
        await this.conversationsRepository
          .createQueryBuilder()
          .delete()
          .where('company_id = :companyId', { companyId })
          .andWhere('contact_id = :contactId', { contactId })
          .execute();
      }

      await this.clientMemoryRepository
        .createQueryBuilder()
        .delete()
        .where('company_id = :companyId', { companyId })
        .andWhere('contact_id = :contactId', { contactId })
        .execute();
      await this.contactMemoryRepository
        .createQueryBuilder()
        .delete()
        .where('company_id = :companyId', { companyId })
        .andWhere('contact_id = :contactId', { contactId })
        .execute();
      await this.contactsRepository.delete({ id: contactId, companyId });
    }

    await this.messagesRepository.delete({ companyId, chatId: conversationId });
    await this.chatsRepository.delete({ id: conversationId, companyId });

    this.prependLog(companyId, {
      id: `log-delete-conversation-${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'Conversation deleted',
      summary: `Se elimino el contacto y la conversacion ${chat.id} desde Bot Center.`,
      severity: 'warning',
      conversationId,
    });

    return { deleted: true };
  }

  async updateConversationAutoReply(
    companyId: string,
    conversationId: string,
    enabled: boolean,
  ): Promise<BotConversationSummary> {
    const chat = await this.getConversationOrThrow(companyId, conversationId);
    chat.autoReplyEnabled = enabled;
    const saved = await this.chatsRepository.save(chat);
    const latestMessage = await this.messagesRepository.findOne({
      where: { companyId, chatId: conversationId },
      order: { createdAt: 'DESC' },
    });

    this.prependLog(companyId, {
      id: `log-${Date.now()}-auto-reply`,
      timestamp: new Date().toISOString(),
      eventType: enabled ? 'AI auto-reply enabled' : 'AI auto-reply paused',
      summary: enabled
        ? 'La IA respondera automaticamente en esta conversación.'
        : 'La IA automática quedó pausada para esta conversación.',
      severity: 'info',
      conversationId,
    });

    return this.toConversationSummary(saved, latestMessage);
  }

  async getConversationDetail(
    companyId: string,
    conversationId: string,
  ): Promise<BotConversationDetailResponse> {
    const chat = await this.getConversationOrThrow(companyId, conversationId);
    const latestMessage = await this.messagesRepository.findOne({
      where: { companyId, chatId: conversationId },
      order: { createdAt: 'DESC' },
    });

    const [messagesResult, contextResult, memoryResult] = await Promise.allSettled([
      this.getConversationMessages(companyId, conversationId),
      this.getConversationContext(companyId, conversationId),
      this.getConversationMemory(companyId, conversationId),
    ]);

    if (messagesResult.status === 'rejected') {
      this.logger.warn(
        `[BOT CENTER] conversation messages fallback companyId=${companyId} conversationId=${conversationId} error=${this.describeUnknownError(messagesResult.reason)}`,
      );
    }
    if (contextResult.status === 'rejected') {
      this.logger.warn(
        `[BOT CENTER] conversation context fallback companyId=${companyId} conversationId=${conversationId} error=${this.describeUnknownError(contextResult.reason)}`,
      );
    }
    if (memoryResult.status === 'rejected') {
      this.logger.warn(
        `[BOT CENTER] conversation memory fallback companyId=${companyId} conversationId=${conversationId} error=${this.describeUnknownError(memoryResult.reason)}`,
      );
    }

    return {
      conversation: this.toConversationSummary(chat, latestMessage),
      messages: messagesResult.status === 'fulfilled' ? messagesResult.value : [],
      context: contextResult.status === 'fulfilled'
        ? contextResult.value
        : this.buildFallbackConversationContext(chat, latestMessage),
      memory: memoryResult.status === 'fulfilled'
        ? memoryResult.value
        : { shortTerm: [], longTerm: [], operational: [] },
    };
  }

  private async getConversationDetailSafely(
    companyId: string,
    conversationId: string,
  ): Promise<BotConversationDetailResponse | undefined> {
    try {
      return await this.getConversationDetail(companyId, conversationId);
    } catch (error) {
      this.logger.warn(
        `[BOT CENTER] selected conversation fallback companyId=${companyId} conversationId=${conversationId} error=${this.describeUnknownError(error)}`,
      );
      return undefined;
    }
  }

  private async getConversationOrThrow(
    companyId: string,
    conversationId: string,
  ): Promise<WhatsappChatEntity> {
    const chat = await this.chatsRepository.findOne({
      where: { id: conversationId, companyId },
    });

    if (!chat) {
      throw new NotFoundException(`Conversation ${conversationId} was not found.`);
    }

    return chat;
  }

  private async resolveCanonicalMemoryTarget(
    companyId: string,
    botCenterConversationId: string,
  ): Promise<{
    chat: WhatsappChatEntity;
    contact: { id: string; phone: string | null };
    conversation: { id: string; channelId: string };
  } | null> {
    const chat = await this.getConversationOrThrow(companyId, botCenterConversationId);
    const channel = await this.resolveCanonicalChannel(companyId, chat);
    if (!channel) {
      return null;
    }

    const contact = await this.contactsService.findOrCreateByPhone(
      companyId,
      this.resolveConversationContactPhone(chat),
      this.resolveContactName(chat),
    );
    const conversation = await this.conversationsService.findOrCreateOpen(
      companyId,
      channel.id,
      contact.id,
    );

    return { chat, contact, conversation };
  }

  private resolveConversationContactPhone(chat: WhatsappChatEntity): string {
    const remoteJid = chat.remoteJid?.trim() ?? '';
    const remoteDigits = remoteJid.replace(/@.+$/, '').replace(/\D/g, '');
    if (remoteDigits) {
      return remoteDigits;
    }

    const sendTarget = chat.sendTarget?.trim();
    if (sendTarget) {
      return sendTarget;
    }

    const canonicalNumber = chat.canonicalNumber?.trim();
    if (canonicalNumber) {
      return canonicalNumber;
    }

    const canonicalRemoteJid = chat.canonicalRemoteJid?.trim();
    if (canonicalRemoteJid?.endsWith('@s.whatsapp.net')) {
      const digits = canonicalRemoteJid.replace(/@.+$/, '').replace(/\D/g, '');
      if (digits) {
        return digits;
      }
    }
    return remoteJid;
  }

  private buildFallbackConversationContext(
    chat: WhatsappChatEntity,
    latestMessage: WhatsappMessageEntity | null,
  ): BotContactContextResponse {
    return {
      customerName: this.resolveContactName(chat),
      phone: this.toConversationPhoneDisplay(chat),
      role: 'Contacto de WhatsApp',
      businessType: 'No disponible',
      city: 'No disponible',
      tags: [
        'WhatsApp',
        ...(chat.unreadCount > 0 ? ['Con mensajes sin leer'] : []),
        ...(latestMessage?.messageType && latestMessage.messageType !== 'text'
          ? [`Ultimo tipo: ${latestMessage.messageType}`]
          : []),
      ],
      productKnowledge: [],
    };
  }

  private describeUnknownError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return typeof error === 'string' ? error : 'unknown_error';
  }

  private async resolveCanonicalChannel(
    companyId: string,
    chat: WhatsappChatEntity,
  ): Promise<{ id: string } | null> {
    const config = await this.channelConfigsRepository.findOne({
      where: {
        id: chat.channelConfigId,
        companyId,
      },
    });
    if (!config) {
      return null;
    }

    try {
      const channel = await this.channelsService.getByCompanyAndInstanceName(
        companyId,
        config.instanceName,
      );
      return { id: channel.id };
    } catch {
      const channels = await this.channelsService.list(companyId);
      const whatsappChannels = channels.filter((channel) => channel.type === 'whatsapp');

      const exactConfigMatch = whatsappChannels.find((channel) => {
        const configuredInstanceName = this.readString(channel.config['instanceName']);
        return configuredInstanceName.length > 0 && configuredInstanceName === config.instanceName;
      });
      if (exactConfigMatch) {
        return { id: exactConfigMatch.id };
      }

      const onlyWhatsappChannel = whatsappChannels.length === 1 ? whatsappChannels[0] : null;
      if (onlyWhatsappChannel) {
        return { id: onlyWhatsappChannel.id };
      }

      return null;
    }
  }

  private async findLatestMessages(
    companyId: string,
    chatIds: string[],
  ): Promise<WhatsappMessageEntity[]> {
    if (chatIds.length === 0) {
      return [];
    }

    return this.messagesRepository
      .createQueryBuilder('message')
      .distinctOn(['message.chatId'])
      .where('message.companyId = :companyId', { companyId })
      .andWhere('message.chatId IN (:...chatIds)', { chatIds })
      .orderBy('message.chatId', 'ASC')
      .addOrderBy('message.createdAt', 'DESC')
      .getMany();
  }

  private toConversationSummary(
    chat: WhatsappChatEntity,
    latestMessage: WhatsappMessageEntity | null,
  ): BotConversationSummary {
    const preview = latestMessage ? this.describeMessage(latestMessage) : 'Sin mensajes todavia';
    const timestamp = chat.lastMessageAt ?? latestMessage?.createdAt ?? chat.updatedAt ?? chat.createdAt;

    return {
      id: chat.id,
      contactName: this.resolveContactName(chat),
      phone: this.toConversationPhoneDisplay(chat),
      autoReplyEnabled: chat.autoReplyEnabled,
      lastMessagePreview: preview,
      unreadCount: chat.unreadCount,
      stage: this.resolveConversationStage(chat, latestMessage),
      timestamp: timestamp.toISOString(),
    };
  }

  private async toBotMessage(message: WhatsappMessageEntity): Promise<BotMessageResponse> {
    const mediaUrl = await this.resolveMessageMediaUrl(message);
    const thumbnailUrl = await this.resolveMessageThumbnailUrl(message, mediaUrl);

    return {
      id: message.id,
      conversationId: message.chatId,
      author: message.fromMe ? 'operator' : 'contact',
      body: this.describeMessage(message),
      type: message.messageType,
      caption: message.caption,
      mimeType: message.mimeType,
      mediaUrl,
      thumbnailUrl,
      fileName: message.mediaOriginalName,
      duration: message.durationSeconds,
      timestamp: message.createdAt.toISOString(),
      state: this.resolveMessageState(message.status),
    };
  }

  async streamPublicVideo(
    messageId: string,
    range?: string,
  ): Promise<{
    stream: Readable;
    contentType: string;
    contentLength: number | null;
    contentRange: string | null;
    acceptRanges: string;
    statusCode: number;
    fileName: string;
  }> {
    const message = await this.messagesRepository.findOne({ where: { id: messageId } });
    if (!message || message.messageType !== 'video') {
      throw new NotFoundException('Video no encontrado.');
    }

    let hydratedMessage = message;
    const repaired = await this.attachmentsService.repairStoredMessageMedia({
      companyId: message.companyId,
      conversationId: message.chatId,
      messageId: message.id,
      fileType: 'video',
      mimeType: message.mimeType,
      originalName: message.mediaOriginalName,
    });
    if (repaired) {
      hydratedMessage = await this.whatsappMessagingService.updateStoredMedia(message.companyId, message.id, {
        mediaStoragePath: repaired.storagePath,
        mediaSizeBytes: repaired.sizeBytes,
        mimeType: repaired.mimeType ?? 'video/mp4',
        mediaUrl: message.mediaUrl,
        thumbnailUrl: repaired.thumbnailStoragePath ?? message.thumbnailUrl,
        durationSeconds: repaired.durationSeconds ?? message.durationSeconds,
      });
    }

    if (!hydratedMessage.mediaStoragePath) {
      throw new NotFoundException('Video almacenado no encontrado.');
    }

    const stored = await this.storageService.getObjectStream({
      companyId: hydratedMessage.companyId,
      key: hydratedMessage.mediaStoragePath,
      range,
    });

    return {
      stream: stored.stream,
      contentType: this.resolveVideoContentType(hydratedMessage.mimeType),
      contentLength: stored.contentLength,
      contentRange: stored.contentRange,
      acceptRanges: stored.acceptRanges ?? 'bytes',
      statusCode: stored.statusCode,
      fileName: this.resolveMessageAssetFileName(hydratedMessage, 'media'),
    };
  }

  private toBotLog(
    log: WhatsappChannelLogEntity,
    chatIdByJid: Map<string, string>,
  ): BotLogResponse {
    const remoteJid = this.extractRemoteJidFromLog(log);
    const statusPrefix = log.httpStatus ? `[${log.httpStatus}] ` : '';

    return {
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      eventType: log.eventName,
      summary: log.errorMessage?.trim().length
        ? `${statusPrefix}${log.errorMessage}`
        : `${statusPrefix}${log.eventName}${log.endpointCalled ? ` -> ${log.endpointCalled}` : ''}`,
      severity: log.success ? 'info' : this.resolveLogSeverity(log),
      conversationId: remoteJid ? chatIdByJid.get(remoteJid) : undefined,
    };
  }

  private resolveConversationStage(
    chat: WhatsappChatEntity,
    latestMessage: WhatsappMessageEntity | null,
  ): BotConversationSummary['stage'] {
    if (latestMessage?.status === 'failed') {
      return 'escalated';
    }
    if (chat.unreadCount > 0) {
      return 'follow_up';
    }
    if (latestMessage?.fromMe) {
      return 'negotiation';
    }
    return 'qualified';
  }

  private resolveMessageState(status: string): BotMessageResponse['state'] {
    switch (status) {
      case 'queued':
        return 'queued';
      case 'sent':
        return 'sent';
      case 'delivered':
        return 'delivered';
      case 'read':
        return 'read';
      case 'failed':
        return 'failed';
      case 'received':
      default:
        return 'sent';
    }
  }

  private resolveLogSeverity(log: WhatsappChannelLogEntity): BotLogSeverity {
    if (log.httpStatus != null && log.httpStatus >= 500) {
      return 'critical';
    }
    return 'warning';
  }

  private describeMessage(message: WhatsappMessageEntity): string {
    const primaryText = message.textBody?.trim() || message.caption?.trim() || '';
    if (primaryText.length > 0) {
      return primaryText;
    }

    switch (message.messageType) {
      case 'image':
        return message.fromMe ? 'Imagen enviada' : 'Imagen recibida';
      case 'video':
        return message.fromMe ? 'Video enviado' : 'Video recibido';
      case 'audio':
        return message.fromMe ? 'Audio enviado' : 'Audio recibido';
      case 'document':
        return message.mediaOriginalName?.trim() || (message.fromMe ? 'Documento enviado' : 'Documento recibido');
      case 'system':
        return 'Actualizacion del sistema';
      default:
        return 'Mensaje sin texto';
    }
  }

  private resolveContactName(chat: WhatsappChatEntity): string {
    return (
      chat.pushName?.trim() ||
      chat.profileName?.trim() ||
      this.toConversationPhoneDisplay(chat)
    );
  }

  private toConversationPhoneDisplay(chat: WhatsappChatEntity): string {
    return this.toPhoneDisplay(this.resolveConversationContactPhone(chat));
  }

  private toPhoneDisplay(remoteJid: string): string {
    const digits = remoteJid.replace(/@.+$/, '').replace(/\D/g, '');
    if (!digits) {
      return remoteJid;
    }

    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }

    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }

    return `+${digits}`;
  }

  private async resolveMessageMediaUrl(message: WhatsappMessageEntity): Promise<string | null> {
    if (message.messageType === 'video') {
      const proxyUrl = this.buildPublicMediaUrl(`/media/video/${message.id}`);
      if (proxyUrl) {
        return proxyUrl;
      }
    }

    const companyId = message.companyId;
    const storagePath = message.mediaStoragePath;
    const fallbackUrl = message.mediaUrl;
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
        // fall through to the fallback URL
      }
    }

    return this.resolveStoredUrlCandidate(companyId, fallbackUrl);
  }

  private async resolveMessageThumbnailUrl(
    message: WhatsappMessageEntity,
    mediaUrl: string | null,
  ): Promise<string | null> {
    if (message.messageType === 'image') {
      return mediaUrl;
    }

    return this.resolveStoredUrlCandidate(message.companyId, message.thumbnailUrl);
  }

  private async resolveStoredUrlCandidate(
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

  private async resolveMessageAssetBuffer(
    companyId: string,
    message: WhatsappMessageEntity,
    variant: 'media' | 'thumbnail',
  ): Promise<{ buffer: Buffer; contentType: string; fileName: string } | null> {
    let hydratedMessage = message;
    if (['image', 'video', 'audio'].includes(message.messageType)) {
      const storedAttachment = await this.attachmentsService.repairStoredMessageMedia({
        companyId,
        conversationId: message.chatId,
        messageId: message.id,
        fileType: message.messageType,
        mimeType: message.mimeType,
        originalName: message.mediaOriginalName,
      });
      if (storedAttachment) {
        hydratedMessage = await this.whatsappMessagingService.updateStoredMedia(companyId, message.id, {
          mediaStoragePath: storedAttachment.storagePath,
          mediaSizeBytes: storedAttachment.sizeBytes,
          mimeType: storedAttachment.mimeType ?? message.mimeType,
          mediaUrl: message.mediaUrl,
          thumbnailUrl: storedAttachment.thumbnailStoragePath ?? message.thumbnailUrl,
          durationSeconds: storedAttachment.durationSeconds ?? message.durationSeconds,
        });
      }
    }

    const storageCandidate =
      variant === 'thumbnail'
        ? this.resolveMessageThumbnailStoragePath(hydratedMessage)
        : hydratedMessage.mediaStoragePath;

    if (storageCandidate) {
      const stored = await this.storageService.getObjectBuffer({
        companyId,
        key: storageCandidate,
      });
      return {
        buffer: stored.buffer,
        contentType: stored.contentType ?? this.resolveMessageAssetContentType(hydratedMessage, variant),
        fileName: this.resolveMessageAssetFileName(hydratedMessage, variant),
      };
    }

    const externalCandidate =
      variant === 'thumbnail'
        ? await this.resolveMessageThumbnailUrl(hydratedMessage, hydratedMessage.mediaUrl)
        : await this.resolveMessageMediaUrl(hydratedMessage);
    if (!externalCandidate) {
      return null;
    }

    const embeddedAsset = this.tryDecodeEmbeddedAsset(
      externalCandidate,
      this.resolveMessageAssetContentType(hydratedMessage, variant),
    );
    if (embeddedAsset) {
      return {
        buffer: embeddedAsset.buffer,
        contentType: embeddedAsset.contentType,
        fileName: this.resolveMessageAssetFileName(hydratedMessage, variant),
      };
    }

    const parsedUrl = this.parseHttpUrl(externalCandidate);
    if (!parsedUrl) {
      return null;
    }

    const response = await fetch(parsedUrl);
    if (!response.ok) {
      return null;
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType:
        response.headers.get('content-type') ??
        this.resolveMessageAssetContentType(hydratedMessage, variant),
      fileName: this.resolveMessageAssetFileName(hydratedMessage, variant),
    };
  }

  private resolveMessageThumbnailStoragePath(message: WhatsappMessageEntity): string | null {
    if (message.messageType === 'image') {
      return message.mediaStoragePath;
    }

    const candidate = message.thumbnailUrl?.trim() ?? '';
    if (!candidate) {
      return null;
    }

    return candidate.startsWith(`${message.companyId}/`) ? candidate : null;
  }

  private resolveMessageAssetContentType(
    message: WhatsappMessageEntity,
    variant: 'media' | 'thumbnail',
  ): string {
    if (variant === 'thumbnail') {
      return message.messageType === 'image'
        ? (message.mimeType ?? 'image/jpeg')
        : 'image/jpeg';
    }

    if (message.messageType === 'video') {
      return this.resolveVideoContentType(message.mimeType);
    }

    return message.mimeType ?? 'application/octet-stream';
  }

  private resolveMessageAssetFileName(
    message: WhatsappMessageEntity,
    variant: 'media' | 'thumbnail',
  ): string {
    if (variant === 'thumbnail') {
      return `${message.id}-thumbnail.jpg`;
    }

    return message.mediaOriginalName?.trim() || `${message.id}.${this.resolveMediaExtension(message.mimeType)}`;
  }

  private resolveMediaExtension(mimeType: string | null): string {
    switch (mimeType?.toLowerCase()) {
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'audio/mpeg':
      case 'audio/mp3':
        return 'mp3';
      case 'audio/mp4':
      case 'audio/m4a':
      case 'audio/aac':
        return 'm4a';
      case 'audio/ogg':
      case 'audio/opus':
        return 'ogg';
      case 'video/mp4':
        return 'mp4';
      case 'video/webm':
        return 'webm';
      case 'video/quicktime':
        return 'mov';
      default:
        return 'jpg';
    }
  }

  private resolveVideoContentType(mimeType: string | null): string {
    const normalized = mimeType?.split(';')[0]?.trim().toLowerCase() ?? '';
    return normalized.startsWith('video/') ? 'video/mp4' : 'video/mp4';
  }

  private buildPublicMediaUrl(path: string): string | null {
    const configuredBaseUrl =
      this.configService.get<string>('BACKEND_PUBLIC_URL') ??
      this.configService.get<string>('APP_BACKEND_URL') ??
      '';
    const trimmedBaseUrl = configuredBaseUrl.trim();
    if (!trimmedBaseUrl) {
      return null;
    }

    try {
      const normalizedBaseUrl = trimmedBaseUrl.endsWith('/') ? trimmedBaseUrl : `${trimmedBaseUrl}/`;
      return new URL(path.replace(/^\//, ''), normalizedBaseUrl).toString();
    } catch {
      return null;
    }
  }

  private tryDecodeEmbeddedAsset(
    candidate: string,
    fallbackContentType: string,
  ): { buffer: Buffer; contentType: string } | null {
    const trimmed = candidate.trim();
    if (!trimmed) {
      return null;
    }

    const dataUrlMatch = /^data:([^;]+);base64,(.+)$/is.exec(trimmed);
    if (dataUrlMatch) {
      const buffer = Buffer.from(dataUrlMatch[2], 'base64');
      if (!buffer.length) {
        return null;
      }

      return {
        buffer,
        contentType: dataUrlMatch[1] || fallbackContentType,
      };
    }

    if (!this.looksLikeRawBase64(trimmed)) {
      return null;
    }

    const buffer = Buffer.from(trimmed, 'base64');
    if (!buffer.length) {
      return null;
    }

    return {
      buffer,
      contentType: fallbackContentType,
    };
  }

  private looksLikeRawBase64(value: string): boolean {
    if (value.length < 32 || value.length % 4 !== 0) {
      return false;
    }

    if (/[^A-Za-z0-9+/=\r\n]/.test(value)) {
      return false;
    }

    return (
      value.startsWith('/9j/') ||
      value.startsWith('iVBOR') ||
      value.startsWith('R0lGOD') ||
      value.startsWith('UklGR')
    );
  }

  private parseHttpUrl(candidate: string): string | null {
    const parsed = URL.parse(candidate);
    if (!parsed) {
      return null;
    }

    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? candidate
      : null;
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

  private extractRemoteJidFromLog(log: WhatsappChannelLogEntity): string | null {
    return this.extractRemoteJid(log.requestPayloadJson) ?? this.extractRemoteJid(log.responsePayloadJson);
  }

  private extractRemoteJid(payload: Record<string, unknown>): string | null {
    const directNumber = this.readString(payload['number']);
    if (directNumber.length > 0) {
      return `${directNumber.replace(/\D/g, '')}@s.whatsapp.net`;
    }

    const requestData = this.readMap(payload['data']);
    const requestKey = this.readMap(requestData['key']);
    const requestRemoteJid = this.readString(requestKey['remoteJid']);
    if (requestRemoteJid.length > 0) {
      return requestRemoteJid;
    }

    const responseKey = this.readMap(payload['key']);
    const responseRemoteJid = this.readString(responseKey['remoteJid']);
    return responseRemoteJid.length > 0 ? responseRemoteJid : null;
  }

  private mapConversationMemoryItem(item: ConversationMemoryEntity): BotMemoryItemResponse {
    return {
      id: item.id,
      title:
        this.readString(item.metadataJson['title']) ||
        this.resolveConversationMemoryTitle(item.role),
      content: item.content,
      type: 'shortTerm',
      updatedAt: this.toIsoString(item.updatedAt),
      isEditable: Boolean(item.metadataJson['isEditable']),
    };
  }

  private mapSummaryMemoryItem(item: ConversationSummaryEntity): BotMemoryItemResponse {
    return {
      id: item.id,
      title: 'Conversation summary',
      content: item.summaryText,
      type: 'longTerm',
      updatedAt: this.toIsoString(item.updatedAt),
      isEditable: false,
    };
  }

  private mapClientMemoryItem(item: ClientMemoryEntity): BotMemoryItemResponse {
    return {
      id: item.id,
      title: this.readString(item.metadata['title']) || item.key,
      content: item.value,
      type: 'longTerm',
      updatedAt: this.toIsoString(item.updatedAt),
      isEditable: true,
    };
  }

  private mapOperationalMemoryItem(item: ContactMemoryEntity): BotMemoryItemResponse {
    return {
      id: item.id,
      title: this.readString(item.metadataJson['title']) || item.key,
      content: item.value,
      type: 'operational',
      updatedAt: this.toIsoString(item.updatedAt),
      isEditable: item.stateType === 'manual_note' || Boolean(item.metadataJson['isEditable']),
    };
  }

  private toIsoString(value: Date | string | null | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string') {
      const normalized = new Date(value);
      if (!Number.isNaN(normalized.getTime())) {
        return normalized.toISOString();
      }
      return value;
    }

    return new Date(0).toISOString();
  }

  private mapManualMemoryItem(item: {
    id: string;
    title: string;
    content: string;
    type: 'shortTerm' | 'longTerm' | 'operational';
    updatedAt: string;
    isEditable: boolean;
  }): BotMemoryItemResponse {
    return {
      id: item.id,
      title: item.title,
      content: item.content,
      type: item.type,
      updatedAt: item.updatedAt,
      isEditable: item.isEditable,
    };
  }

  private resolveConversationMemoryTitle(role: ConversationMemoryEntity['role']): string {
    switch (role) {
      case 'user':
        return 'Incoming message';
      case 'assistant':
        return 'Outgoing message';
      case 'tool':
        return 'Tool execution';
      case 'system':
      default:
        return 'System note';
    }
  }

  private prependLog(companyId: string, log: BotLogResponse): void {
    this.runtimeLogs.unshift({ companyId, ...log });
    if (this.runtimeLogs.length > 200) {
      this.runtimeLogs.length = 200;
    }
  }

  private buildStatusCard(
    label: string,
    value: string,
    description: string,
    state: ServiceHealthState,
  ): BotStatusCardResponse {
    return { label, value, description, state };
  }

  private readMap(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
