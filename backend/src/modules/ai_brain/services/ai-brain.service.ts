import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BotsService } from '../../bots/bots.service';
import { ChannelsService } from '../../channels/channels.service';
import { CompaniesService } from '../../companies/companies.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { EvolutionService } from '../../evolution/evolution.service';
import { MessagesService } from '../../messages/messages.service';
import { OpenAiService } from '../../openai/services/openai.service';
import { ToolEntity } from '../../tools/entities/tool.entity';
import { ToolsService } from '../../tools/tools.service';
import { AiBrainLogEntity } from '../entities/ai-brain-log.entity';
import { AiBrainCacheService } from './ai-brain-cache.service';
import { AiBrainContextBuilderService } from './ai-brain-context-builder.service';
import { AiBrainDocumentService } from './ai-brain-document.service';
import { AiBrainMemoryService } from './ai-brain-memory.service';
import { AiBrainToolRouterService } from './ai-brain-tool-router.service';

@Injectable()
export class AiBrainService {
  private readonly logger = new Logger(AiBrainService.name);

  constructor(
    private readonly companiesService: CompaniesService,
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly botsService: BotsService,
    private readonly toolsService: ToolsService,
    private readonly evolutionService: EvolutionService,
    private readonly openAiService: OpenAiService,
    private readonly aiBrainCacheService: AiBrainCacheService,
    private readonly aiBrainDocumentService: AiBrainDocumentService,
    private readonly aiBrainMemoryService: AiBrainMemoryService,
    private readonly aiBrainContextBuilderService: AiBrainContextBuilderService,
    private readonly aiBrainToolRouterService: AiBrainToolRouterService,
    @InjectRepository(AiBrainLogEntity)
    private readonly aiBrainLogsRepository: Repository<AiBrainLogEntity>,
  ) {}

  async processInboundMessage(params: {
    companyId: string;
    channelId: string;
    conversationId: string;
    contactPhone: string;
    messageId: string;
  }): Promise<{ ok: true }> {
    const startedAt = Date.now();
    const company = await this.companiesService.getMyCompany(params.companyId);
    const channel = await this.channelsService.get(params.companyId, params.channelId);
    const conversation = await this.conversationsService.get(params.companyId, params.conversationId);
    const contact = await this.contactsService.get(params.companyId, conversation.contactId);
    const bot = await this.botsService.getDefaultActiveBot(params.companyId);
    const recentMessages = await this.messagesService.list(params.companyId, params.conversationId, 20);
    const lastUserMessage = recentMessages.filter((message) => message.sender === 'client').slice(-1)[0];

    const userMessage = lastUserMessage?.content?.trim() || '';
    const contactPhone = params.contactPhone || contact.phone || '';
    const detectedIntent = this.detectIntent(userMessage);

    await this.aiBrainCacheService.appendInboundBuffer(contactPhone, userMessage);

    const extractedMemories = this.aiBrainMemoryService.extractClientMemories(userMessage);
    if (extractedMemories.length > 0) {
      await this.aiBrainMemoryService.upsertExtractedMemories({
        companyId: params.companyId,
        contactId: contact.id,
        conversationId: params.conversationId,
        items: extractedMemories,
      });
    }

    const [memoryItems, bufferedMessages, runtimeContext, activeTools, documents] = await Promise.all([
      this.aiBrainMemoryService.listByContact(params.companyId, contact.id),
      this.aiBrainCacheService.getInboundBuffer(contactPhone),
      this.aiBrainCacheService.getConversationContext(params.companyId, contactPhone),
      this.listActiveTools(params.companyId, bot.id),
      this.aiBrainDocumentService.list(params.companyId, bot.id),
    ]);

    const context = this.aiBrainContextBuilderService.build({
      company,
      bot,
      contact,
      recentMessages,
      memoryItems,
      documents,
      activeTools,
      bufferedMessages: [
        ...(runtimeContext?.lastMessages ?? []),
        ...bufferedMessages,
      ].slice(-8),
      detectedIntent,
    });

    const firstDraft = await this.openAiService.draftResponse({
      message: userMessage,
      senderName: contact.name || undefined,
      detectedIntent,
      systemPrompt: context.prompt,
      memoryContext: context.memoryContext,
    });

    let finalContent = firstDraft.content;
    let executedTool: { tool: string; ok: boolean; result: unknown } | null = null;

    const toolRequest = this.aiBrainToolRouterService.tryParse(firstDraft.content, activeTools);
    if (toolRequest) {
      executedTool = await this.aiBrainToolRouterService.run({
        companyId: params.companyId,
        botId: bot.id,
        contactId: contact.id,
        request: toolRequest,
      });

      const followUp = await this.openAiService.draftResponse({
        message: `${userMessage}\n\nResultado de herramienta: ${JSON.stringify(executedTool.result)}`,
        senderName: contact.name || undefined,
        detectedIntent,
        systemPrompt: context.prompt,
        memoryContext: `${context.memoryContext}\n\nTool result:\n${JSON.stringify(executedTool.result)}`,
      });

      finalContent = followUp.content;
    }

    const botMessage = await this.messagesService.create(params.companyId, params.conversationId, {
      sender: 'bot',
      content: finalContent,
      type: 'text',
      metadata: {
        provider: firstDraft.provider,
        model: firstDraft.model,
        detectedIntent,
        tool: executedTool?.tool ?? null,
      },
    });

    if (channel.type === 'whatsapp' && channel.instanceName && contactPhone) {
      await this.evolutionService.sendMessage({
        instanceName: channel.instanceName,
        phone: contactPhone,
        message: botMessage.content,
      });
    } else if (channel.type === 'whatsapp' && !channel.instanceName) {
      this.logger.warn(`WhatsApp channel ${channel.id} has no instanceName; outbound send skipped.`);
    }

    await this.aiBrainCacheService.storeConversationContext({
      companyId: params.companyId,
      phone: contactPhone,
      detectedIntent,
      lastMessages: recentMessages.slice(-6).map((message) => `${message.sender}: ${message.content}`),
      lastResponse: botMessage.content,
    });

    await this.aiBrainLogsRepository.save(
      this.aiBrainLogsRepository.create({
        companyId: params.companyId,
        conversationId: params.conversationId,
        contactId: contact.id,
        botId: bot.id,
        channelId: channel.id,
        status: 'processed',
        detectedIntent,
        provider: firstDraft.provider,
        model: firstDraft.model,
        latencyMs: Date.now() - startedAt,
        metadata: {
          messageId: params.messageId,
          outboundMessageId: botMessage.id,
          memoryItems: context.memoryItems,
          documentSnippets: context.documentSnippets,
          tool: executedTool,
        },
      }),
    );

    return { ok: true };
  }

  async listLogs(companyId: string, limit = 30) {
    return this.aiBrainLogsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  private async listActiveTools(companyId: string, botId: string): Promise<ToolEntity[]> {
    const tools = await this.toolsService.list(companyId);
    return tools.filter((tool) => tool.active && (!tool.botId || tool.botId === botId));
  }

  private detectIntent(message: string): string {
    const normalized = message.toLowerCase();
    if (!normalized) {
      return 'unknown';
    }
    if (/(precio|cu[aá]nto|cotiz|costo)/.test(normalized)) {
      return 'pricing';
    }
    if (/(comprar|pedido|orden|quiero)/.test(normalized)) {
      return 'purchase';
    }
    if (/(soporte|ayuda|problema|falla)/.test(normalized)) {
      return 'support';
    }
    if (/(horario|ubicaci[oó]n|direcci[oó]n)/.test(normalized)) {
      return 'company-info';
    }
    return 'general';
  }
}