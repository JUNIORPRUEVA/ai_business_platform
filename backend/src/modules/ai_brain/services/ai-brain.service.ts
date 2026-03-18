import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { BotsService } from '../../bots/bots.service';
import { ChannelsService } from '../../channels/channels.service';
import { CompaniesService } from '../../companies/companies.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MemoryService } from '../../ai-engine/memory.service';
import { EvolutionService } from '../../evolution/evolution.service';
import { MessagesService } from '../../messages/messages.service';
import { OpenAiService } from '../../openai/services/openai.service';
import { ToolEntity } from '../../tools/entities/tool.entity';
import { ToolsService } from '../../tools/tools.service';
import { AiBrainLogEntity } from '../entities/ai-brain-log.entity';
import { AiBrainContextBuilderService } from './ai-brain-context-builder.service';
import { AiBrainDocumentService } from './ai-brain-document.service';
import { AiBrainToolRouterService } from './ai-brain-tool-router.service';

@Injectable()
export class AiBrainService {
  private readonly logger = new Logger(AiBrainService.name);

  constructor(
    private readonly botConfigurationService: BotConfigurationService,
    private readonly companiesService: CompaniesService,
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly botsService: BotsService,
    private readonly toolsService: ToolsService,
    private readonly evolutionService: EvolutionService,
    private readonly memoryService: MemoryService,
    private readonly openAiService: OpenAiService,
    private readonly aiBrainDocumentService: AiBrainDocumentService,
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
    const configuration = this.botConfigurationService.getConfiguration();
    const memoryWindowSize = Math.min(
      Math.max(configuration.memory.recentMessageWindowSize, 1),
      50,
    );
    const summaryRefreshThreshold = Math.min(
      Math.max(configuration.memory.summaryRefreshThreshold, 2),
      50,
    );
    const company = await this.companiesService.getMyCompany(params.companyId);
    const channel = await this.channelsService.get(params.companyId, params.channelId);
    const conversation = await this.conversationsService.get(params.companyId, params.conversationId);
    const contact = await this.contactsService.get(params.companyId, conversation.contactId);
    const bot = await this.botsService.getDefaultActiveBot(params.companyId);
    const recentMessages = await this.messagesService.list(
      params.companyId,
      params.conversationId,
      Math.max(memoryWindowSize, 20),
    );
    const lastUserMessage = recentMessages.filter((message) => message.sender === 'client').slice(-1)[0];

    const userMessage = lastUserMessage?.content?.trim() || '';
    const contactPhone = params.contactPhone || contact.phone || '';
    const detectedIntent = this.detectIntent(userMessage);
    const baseSystemPrompt =
      bot.systemPrompt?.trim() ||
      configuration.prompts[0]?.content ||
      configuration.openai.systemPromptPreview;

    if (configuration.memory.enableShortTermMemory && configuration.memory.usePostgreSql) {
      await this.backfillConversationMemoryIfNeeded(
        params.companyId,
        params.conversationId,
        recentMessages,
        conversation.contactId,
        baseSystemPrompt,
      );

      if (userMessage) {
        await this.memoryService.appendConversationMemory({
          companyId: params.companyId,
          contactId: contact.id,
          conversationId: params.conversationId,
          role: 'user',
          content: userMessage,
          contentType: 'text',
          metadataJson: {
            channel: channel.type,
            senderPhone: contactPhone,
          },
          source: 'inbound_message',
          messageId: params.messageId,
          eventId: params.messageId,
          dedupeAgainstLast: true,
        });
      }
    }

    const extractedMemories = this.memoryService.extractClientMemories(userMessage);
    if (extractedMemories.length > 0) {
      await this.memoryService.upsertClientMemories({
        companyId: params.companyId,
        contactId: contact.id,
        conversationId: params.conversationId,
        items: extractedMemories.map((item) => ({
          ...item,
          metadata: {
            source: 'auto-extraction',
          },
        })),
      });
    }

    if (configuration.memory.enableOperationalMemory && configuration.memory.usePostgreSql) {
      await this.memoryService.setContactMemory({
        companyId: params.companyId,
        contactId: contact.id,
        conversationId: params.conversationId,
        key: 'last_detected_intent',
        value: detectedIntent,
        stateType: 'operational',
        metadataJson: {
          channel: channel.type,
        },
      });
    }

    const [assembledMemory, activeTools, documents] = await Promise.all([
      this.memoryService.assembleContext({
        companyId: params.companyId,
        contactId: contact.id,
        conversationId: params.conversationId,
        recentWindowSize: memoryWindowSize,
        incomingMessage: userMessage,
      }),
      this.listActiveTools(params.companyId, bot.id),
      this.aiBrainDocumentService.list(params.companyId, bot.id),
    ]);

    const memoryFacts = [
      ...assembledMemory.keyFacts.map((item) => ({
        key: item.key,
        value: item.value,
        category: item.category,
      })),
      ...assembledMemory.operationalState
        .filter((item) => assembledMemory.keyFacts.every((memoryItem) => memoryItem.key !== item.key))
        .slice(0, 8)
        .map((item) => ({
          key: item.key,
          value: item.value,
          category: 'operational',
        })),
      ...Object.entries(await this.memoryService.getContactMemoryMap(params.companyId, contact.id))
        .filter(([key]) => assembledMemory.keyFacts.every((item) => item.key !== key))
        .map(([key, value]) => ({
          key,
          value,
          category: 'contact_memory',
        })),
    ];

    const context = this.aiBrainContextBuilderService.build({
      company,
      bot,
      contact,
      memoryItems: memoryFacts,
      documents,
      activeTools,
      assembledMemoryContext: assembledMemory.contextText,
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

      if (configuration.memory.enableOperationalMemory && configuration.memory.usePostgreSql) {
        await this.memoryService.appendConversationMemory({
          companyId: params.companyId,
          contactId: contact.id,
          conversationId: params.conversationId,
          role: 'tool',
          content: `Tool executed: ${executedTool.tool}. Result: ${JSON.stringify(executedTool.result)}`,
          contentType: 'json',
          metadataJson: {
            tool: executedTool.tool,
            ok: executedTool.ok,
          },
          source: 'tool_execution',
          dedupeAgainstLast: false,
        });

        await this.memoryService.setContactMemory({
          companyId: params.companyId,
          contactId: contact.id,
          conversationId: params.conversationId,
          key: 'last_tool',
          value: executedTool.tool,
          stateType: 'operational',
          metadataJson: {
            ok: executedTool.ok,
          },
        });
      }

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

    if (configuration.memory.enableShortTermMemory && configuration.memory.usePostgreSql) {
      await this.memoryService.appendConversationMemory({
        companyId: params.companyId,
        contactId: contact.id,
        conversationId: params.conversationId,
        role: 'assistant',
        content: botMessage.content,
        contentType: 'text',
        metadataJson: {
          provider: firstDraft.provider,
          model: firstDraft.model,
        },
        source: 'assistant_response',
        messageId: botMessage.id,
        dedupeAgainstLast: true,
      });
    }

    if (channel.type === 'whatsapp' && channel.instanceName && contactPhone) {
      await this.evolutionService.sendMessage({
        instanceName: channel.instanceName,
        phone: contactPhone,
        message: botMessage.content,
      });
    } else if (channel.type === 'whatsapp' && !channel.instanceName) {
      this.logger.warn(`WhatsApp channel ${channel.id} has no instanceName; outbound send skipped.`);
    }

    if (configuration.memory.summaryEnabled && configuration.memory.usePostgreSql) {
      await this.memoryService.refreshConversationSummary({
        companyId: params.companyId,
        contactId: contact.id,
        conversationId: params.conversationId,
        recentWindowSize: memoryWindowSize,
        summaryRefreshThreshold,
      });
    }

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

  private async backfillConversationMemoryIfNeeded(
    companyId: string,
    conversationId: string,
    recentMessages: Array<{ sender: string; content: string }>,
    contactId: string,
    baseSystemPrompt: string,
  ): Promise<void> {
    const existing = await this.memoryService.listConversationMemory(companyId, conversationId, 1);
    if (existing.length > 0) {
      return;
    }

    await this.memoryService.ensureConversationSystemPrompt(
      {
        companyId,
        contactId,
        conversationId,
        content: baseSystemPrompt,
      },
    );

    for (const message of recentMessages) {
      const role = message.sender === 'bot' ? 'assistant' : 'user';
      await this.memoryService.appendConversationMemory({
        companyId,
        contactId,
        conversationId,
        role,
        content: message.content,
        contentType: 'text',
        metadataJson: {},
        source: message.sender === 'bot' ? 'assistant_response' : 'inbound_message',
        dedupeAgainstLast: false,
      });
    }
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