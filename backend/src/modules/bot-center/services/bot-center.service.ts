import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DatabaseService } from '../../../common/database/database.service';
import { ClientMemoryEntity } from '../../ai_brain/entities/client-memory.entity';
import { MemoryService } from '../../ai-engine/memory.service';
import { ContactMemoryEntity } from '../../ai-engine/entities/contact-memory.entity';
import { ConversationMemoryEntity } from '../../ai-engine/entities/conversation-memory.entity';
import { ConversationSummaryEntity } from '../../ai-engine/entities/conversation-summary.entity';
import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { WhatsappChannelLogEntity } from '../../whatsapp-channel/entities/whatsapp-channel-log.entity';
import { WhatsappChatEntity } from '../../whatsapp-channel/entities/whatsapp-chat.entity';
import { WhatsappMessageEntity } from '../../whatsapp-channel/entities/whatsapp-message.entity';
import { WhatsappMessagingService } from '../../whatsapp-channel/services/whatsapp-messaging.service';
import { CreateMemoryItemDto } from '../dto/create-memory-item.dto';
import { SendTestMessageDto } from '../dto/send-test-message.dto';
import { UpdateMemoryItemDto } from '../dto/update-memory-item.dto';
import { UpdatePromptDto } from '../dto/update-prompt.dto';
import {
  BotCenterOverviewResponse,
  BotContactContextResponse,
  BotConversationDetailResponse,
  BotConversationSummary,
  BotLogResponse,
  BotLogSeverity,
  BotMemoryItemResponse,
  BotMemoryResponse,
  BotMessageResponse,
  BotPromptConfigResponse,
  BotStatusCardResponse,
  BotStatusResponse,
  BotToolResponse,
  SendTestMessageResponse,
  ServiceHealthState,
} from '../types/bot-center.types';

@Injectable()
export class BotCenterService {
  private readonly runtimeLogs: Array<BotLogResponse & { companyId: string }> = [];

  constructor(
    private readonly botConfigurationService: BotConfigurationService,
    private readonly memoryService: MemoryService,
    private readonly databaseService: DatabaseService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
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
    private readonly whatsappMessagingService: WhatsappMessagingService,
  ) {}

  async getOverview(
    companyId: string,
    selectedConversationId?: string,
  ): Promise<BotCenterOverviewResponse> {
    const conversations = await this.listConversations(companyId);
    const selectedConversation = selectedConversationId
      ? await this.getConversationDetail(companyId, selectedConversationId)
      : conversations.length > 0
          ? await this.getConversationDetail(companyId, conversations[0].id)
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

    return messages.map((message) => this.toBotMessage(message));
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
      phone: this.toPhoneDisplay(chat.remoteJid),
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

  async getConversationMemory(
    companyId: string,
    conversationId: string,
  ): Promise<BotMemoryResponse> {
    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, conversationId);
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
    const memoryTarget = await this.resolveCanonicalMemoryTarget(companyId, payload.conversationId);
    const conversation = memoryTarget.chat;
    const dispatchedAt = new Date().toISOString();

    await this.whatsappMessagingService.sendText(companyId, {
      remoteJid: conversation.remoteJid,
      text: payload.message,
    });

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

    this.prependLog(companyId, {
      id: `log-${Date.now() + 1}`,
      timestamp: dispatchedAt,
      eventType: 'Message dispatched',
      summary: `Se envio un mensaje desde Bot Center a ${this.toPhoneDisplay(conversation.remoteJid)}.`,
      severity: 'info',
      conversationId: payload.conversationId,
    });

    return {
      success: true,
      conversationId: payload.conversationId,
      message: 'Mensaje enviado correctamente por el canal de WhatsApp.',
      dispatchedAt,
      status: 'accepted',
    };
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

    return {
      conversation: this.toConversationSummary(chat, latestMessage),
      messages: await this.getConversationMessages(companyId, conversationId),
      context: await this.getConversationContext(companyId, conversationId),
      memory: await this.getConversationMemory(companyId, conversationId),
    };
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
    contact: { id: string };
    conversation: { id: string };
  }> {
    const chat = await this.getConversationOrThrow(companyId, botCenterConversationId);
    const contact = await this.contactsService.findOrCreateByPhone(
      companyId,
      chat.remoteJid,
      this.resolveContactName(chat),
    );
    const conversation = await this.conversationsService.findOrCreateOpen(
      companyId,
      chat.channelConfigId,
      contact.id,
    );

    return { chat, contact, conversation };
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
      phone: this.toPhoneDisplay(chat.remoteJid),
      lastMessagePreview: preview,
      unreadCount: chat.unreadCount,
      stage: this.resolveConversationStage(chat, latestMessage),
      timestamp: timestamp.toISOString(),
    };
  }

  private toBotMessage(message: WhatsappMessageEntity): BotMessageResponse {
    return {
      id: message.id,
      conversationId: message.chatId,
      author: message.fromMe ? 'operator' : 'contact',
      body: this.describeMessage(message),
      timestamp: message.createdAt.toISOString(),
      state: this.resolveMessageState(message.status),
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
      case 'received':
      default:
        return 'read';
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
    return chat.pushName?.trim() || chat.profileName?.trim() || this.toPhoneDisplay(chat.remoteJid);
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
      updatedAt: item.updatedAt.toISOString(),
      isEditable: Boolean(item.metadataJson['isEditable']),
    };
  }

  private mapSummaryMemoryItem(item: ConversationSummaryEntity): BotMemoryItemResponse {
    return {
      id: item.id,
      title: 'Conversation summary',
      content: item.summaryText,
      type: 'longTerm',
      updatedAt: item.updatedAt.toISOString(),
      isEditable: false,
    };
  }

  private mapClientMemoryItem(item: ClientMemoryEntity): BotMemoryItemResponse {
    return {
      id: item.id,
      title: this.readString(item.metadata['title']) || item.key,
      content: item.value,
      type: 'longTerm',
      updatedAt: item.updatedAt.toISOString(),
      isEditable: true,
    };
  }

  private mapOperationalMemoryItem(item: ContactMemoryEntity): BotMemoryItemResponse {
    return {
      id: item.id,
      title: this.readString(item.metadataJson['title']) || item.key,
      content: item.value,
      type: 'operational',
      updatedAt: item.updatedAt.toISOString(),
      isEditable: item.stateType === 'manual_note' || Boolean(item.metadataJson['isEditable']),
    };
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