import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MemoryService } from '../../ai-engine/memory.service';
import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { BotConfigurationBundle } from '../../bot-configuration/types/bot-configuration.types';
import { BotEntity } from '../../bots/entities/bot.entity';
import { BotsService } from '../../bots/bots.service';
import { ChannelEntity } from '../../channels/entities/channel.entity';
import { ChannelsService } from '../../channels/channels.service';
import { CompaniesService } from '../../companies/companies.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessageEntity } from '../../messages/entities/message.entity';
import { MessagesService } from '../../messages/messages.service';
import { OpenAiChatMessage } from '../../openai/types/openai.types';
import { OpenAiService } from '../../openai/services/openai.service';
import { PromptEntity } from '../../prompts/entities/prompt.entity';
import { PromptsService } from '../../prompts/prompts.service';
import { ToolEntity } from '../../tools/entities/tool.entity';
import { ToolsService } from '../../tools/tools.service';
import { WhatsappMessagingService } from '../../whatsapp-channel/services/whatsapp-messaging.service';
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
    private readonly promptsService: PromptsService,
    private readonly memoryService: MemoryService,
    private readonly openAiService: OpenAiService,
    private readonly aiBrainDocumentService: AiBrainDocumentService,
    private readonly aiBrainContextBuilderService: AiBrainContextBuilderService,
    private readonly aiBrainToolRouterService: AiBrainToolRouterService,
    private readonly whatsappMessagingService: WhatsappMessagingService,
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

    let channel: ChannelEntity | null = null;
    let bot: BotEntity | null = null;
    let contactId: string | null = null;
    let detectedIntent = 'unknown';

    try {
      this.logger.log(
        `[AI BRAIN] inbound received conversationId=${params.conversationId} companyId=${params.companyId} channelId=${params.channelId} messageId=${params.messageId}`,
      );

      const company = await this.companiesService.getMyCompany(params.companyId);
      channel = await this.channelsService.get(params.companyId, params.channelId);
      const conversation = await this.conversationsService.get(
        params.companyId,
        params.conversationId,
      );
      const contact = await this.contactsService.get(params.companyId, conversation.contactId);
      contactId = contact.id;

      const recentMessages = await this.messagesService.list(
        params.companyId,
        params.conversationId,
        Math.max(memoryWindowSize, 20),
      );
      const currentInboundMessage =
        recentMessages.filter((message) => message.sender === 'client').slice(-1)[0] ?? null;
      const userMessage = currentInboundMessage?.content?.trim() || '';
      const contactPhone = (params.contactPhone || contact.phone || '').trim();

      bot = await this.resolveActiveBot(params.companyId, channel);
      this.logger.log(
        `[AI BRAIN] bot resolved botId=${bot.id} channelId=${channel.id} model=${bot.model}`,
      );

      detectedIntent = this.detectIntent(userMessage);
      const respondability = this.shouldRespondToInbound({
        configuration,
        bot,
        channel,
        userMessage,
      });
      if (!respondability.ok) {
        this.logger.warn(
          `[AI BRAIN] skipped conversationId=${params.conversationId} reason=${respondability.reason}`,
        );
        await this.persistAiBrainLog({
          companyId: params.companyId,
          conversationId: params.conversationId,
          contactId: contact.id,
          botId: bot.id,
          channelId: channel.id,
          status: 'skipped',
          detectedIntent,
          provider: null,
          model: bot.model,
          latencyMs: Date.now() - startedAt,
          metadata: {
            messageId: params.messageId,
            reason: respondability.reason,
          },
        });
        return { ok: true };
      }

      const activePrompts = await this.promptsService.listActive(params.companyId);
      const promptInputs = this.resolvePromptInputs(
        configuration,
        bot,
        detectedIntent,
        activePrompts,
      );

      if (configuration.memory.enableShortTermMemory) {
        await this.backfillConversationMemoryIfNeeded(
          params.companyId,
          params.conversationId,
          recentMessages,
          conversation.contactId,
          promptInputs.systemInstructions,
        );

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

      if (configuration.memory.enableOperationalMemory) {
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

      const activeTools = configuration.orchestrator.enableToolExecution
        ? await this.listActiveTools(params.companyId, bot.id)
        : [];
      const [assembledMemory, documents, contactMemoryMap] = await Promise.all([
        this.memoryService.assembleContext({
          companyId: params.companyId,
          contactId: contact.id,
          conversationId: params.conversationId,
          recentWindowSize: memoryWindowSize,
          incomingMessage: userMessage,
        }),
        this.aiBrainDocumentService.listAvailable(params.companyId, bot.id),
        this.memoryService.getContactMemoryMap(params.companyId, contact.id),
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
        ...Object.entries(contactMemoryMap)
          .filter(([key]) => assembledMemory.keyFacts.every((item) => item.key !== key))
          .map(([key, value]) => ({
            key,
            value,
            category: 'contact_memory',
          })),
      ];

      this.logger.log(
        `[AI BRAIN] memory loaded summary=${assembledMemory.summary != null} facts=${assembledMemory.keyFacts.length} window=${assembledMemory.recentWindow.length}`,
      );
      this.logger.log(`[AI BRAIN] tools resolved count=${activeTools.length}`);

      const directShortReply = this.buildDeterministicReplyIfApplicable({
        userMessage,
        recentMessages,
        senderName: contact.name || null,
      });

      const recentTranscriptMessages = this.buildRecentTranscriptMessages(recentMessages);
      const context = this.aiBrainContextBuilderService.build({
        company,
        bot,
        contact,
        memoryItems: memoryFacts,
        documents,
        activeTools,
        assembledMemoryContext: assembledMemory.contextText,
        detectedIntent,
        systemInstructions: promptInputs.systemInstructions,
        mainBotPrompt: promptInputs.mainBotPrompt,
        businessRules: promptInputs.businessRules,
        recentMessages: recentTranscriptMessages,
        incomingMessage: userMessage,
      });
      const approximatePromptTokens = this.approximateTokenCount(
        context.modelMessages.map((item) => item.content),
      );
      this.logger.log(
        `[AI BRAIN] prompt built tokens=${approximatePromptTokens} messages=${context.modelMessages.length}`,
      );

      let firstDraft: OpenAiDraftResponse = {
        provider: 'mock',
        model: bot.model,
        content: directShortReply ?? '',
        usedMockFallback: directShortReply != null,
        systemPrompt: promptInputs.systemInstructions,
      };
      let finalContent = directShortReply ?? '';
      let executedTool: { tool: string; ok: boolean; result: unknown } | null = null;

      if (directShortReply != null) {
        this.logger.log(
          `[AI BRAIN] direct short reply applied conversationId=${params.conversationId} reason=short_message_guardrail`,
        );
      } else {
        this.logger.log(`[AI BRAIN] openai request started model=${bot.model}`);
        firstDraft = await this.openAiService.draftResponse({
          senderName: contact.name || undefined,
          detectedIntent,
          messages: context.modelMessages,
          model: bot.model,
          temperature: bot.temperature,
          maxTokens: configuration.openai.maxTokens,
        });
        this.logger.log(
          `[AI BRAIN] openai response received provider=${firstDraft.provider} fallback=${firstDraft.usedMockFallback}`,
        );

        finalContent = firstDraft.content;

        const toolRequest = configuration.orchestrator.enableToolExecution
          ? this.aiBrainToolRouterService.tryParse(firstDraft.content, activeTools)
          : null;
        if (!toolRequest) {
          finalContent = this.normalizeAssistantReply({
            draft: finalContent,
            userMessage,
            recentMessages,
            senderName: contact.name || null,
          });
        }

        if (!toolRequest) {
          executedTool = null;
        } else {
        executedTool = await this.aiBrainToolRouterService.run({
          companyId: params.companyId,
          botId: bot.id,
          contactId: contact.id,
          request: toolRequest,
        });

        if (configuration.memory.enableOperationalMemory) {
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
          senderName: contact.name || undefined,
          detectedIntent,
          model: bot.model,
          temperature: bot.temperature,
          maxTokens: configuration.openai.maxTokens,
          messages: [
            ...context.modelMessages,
            {
              role: 'assistant',
              content: `[tool:${executedTool.tool}] ${JSON.stringify(executedTool.result)}`,
            },
            {
              role: 'user',
              content:
                'Usa el resultado de la herramienta para responder al cliente con un mensaje final claro, útil y listo para enviar por WhatsApp.',
            },
          ],
        });

        finalContent = followUp.content;
        }
      }

      finalContent = this.normalizeAssistantReply({
        draft: finalContent,
        userMessage,
        recentMessages,
        senderName: contact.name || null,
      });

      const botMessage = await this.messagesService.create(params.companyId, params.conversationId, {
        sender: 'bot',
        content: finalContent,
        type: 'text',
        metadata: {
          provider: firstDraft.provider,
          model: bot.model,
          detectedIntent,
          tool: executedTool?.tool ?? null,
          usedMockFallback: firstDraft.usedMockFallback,
        },
      });
      this.logger.log(`[AI BRAIN] assistant message saved id=${botMessage.id}`);

      if (configuration.memory.enableShortTermMemory) {
        await this.memoryService.appendConversationMemory({
          companyId: params.companyId,
          contactId: contact.id,
          conversationId: params.conversationId,
          role: 'assistant',
          content: botMessage.content,
          contentType: 'text',
          metadataJson: {
            provider: firstDraft.provider,
            model: bot.model,
          },
          source: 'assistant_response',
          messageId: botMessage.id,
          dedupeAgainstLast: true,
        });
      }

      let outboundTransportMessageId: string | null = null;
      if (channel.type === 'whatsapp') {
        if (!contactPhone) {
          this.logger.warn(
            `[AI BRAIN] whatsapp send skipped conversationId=${params.conversationId} reason=missing_contact_phone`,
          );
        } else {
          const outboundDispatch = await this.whatsappMessagingService.sendText(
            params.companyId,
            {
              remoteJid: contactPhone,
              text: botMessage.content,
            },
          );
          const outboundMessageView = this.readRecord(outboundDispatch['message']);
          outboundTransportMessageId = this.readString(outboundMessageView['id']) || null;
          this.logger.log(
            `[AI BRAIN] whatsapp send success conversationId=${params.conversationId} whatsappMessageId=${outboundTransportMessageId ?? 'n/a'}`,
          );
        }
      }

      if (configuration.memory.summaryEnabled) {
        await this.memoryService.refreshConversationSummary({
          companyId: params.companyId,
          contactId: contact.id,
          conversationId: params.conversationId,
          recentWindowSize: memoryWindowSize,
          summaryRefreshThreshold,
        });
      }

      await this.persistAiBrainLog({
        companyId: params.companyId,
        conversationId: params.conversationId,
        contactId: contact.id,
        botId: bot.id,
        channelId: channel.id,
        status: 'processed',
        detectedIntent,
        provider: firstDraft.provider,
        model: bot.model,
        latencyMs: Date.now() - startedAt,
        metadata: {
          messageId: params.messageId,
          outboundMessageId: botMessage.id,
          outboundTransportMessageId,
          promptApproxTokens: approximatePromptTokens,
          summaryLoaded: assembledMemory.summary != null,
          keyFactsCount: assembledMemory.keyFacts.length,
          operationalCount: assembledMemory.operationalState.length,
          recentWindowCount: assembledMemory.recentWindow.length,
          memoryItems: context.memoryItems,
          documentSnippets: context.documentSnippets,
          tool: executedTool,
          usedMockFallback: firstDraft.usedMockFallback,
        },
      });

      this.logger.log(
        `[AI BRAIN] completed conversationId=${params.conversationId} companyId=${params.companyId}`,
      );
      return { ok: true };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      this.logger.error(
        `[AI BRAIN] failed conversationId=${params.conversationId} companyId=${params.companyId} reason=${reason}`,
      );

      if (channel && bot && contactId) {
        await this.persistAiBrainLog({
          companyId: params.companyId,
          conversationId: params.conversationId,
          contactId,
          botId: bot.id,
          channelId: channel.id,
          status: 'failed',
          detectedIntent,
          provider: null,
          model: bot.model,
          latencyMs: Date.now() - startedAt,
          metadata: {
            messageId: params.messageId,
            reason,
          },
        });
      }

      throw error;
    }
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

    await this.memoryService.ensureConversationSystemPrompt({
      companyId,
      contactId,
      conversationId,
      content: baseSystemPrompt,
    });

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

  private async resolveActiveBot(companyId: string, channel: ChannelEntity): Promise<BotEntity> {
    const configuredBotId = this.readString(channel.config['botId']);
    if (configuredBotId) {
      try {
        return await this.botsService.get(companyId, configuredBotId);
      } catch (error) {
        this.logger.warn(
          `[AI BRAIN] configured bot not found for channelId=${channel.id} botId=${configuredBotId}; falling back to default active bot`,
        );
      }
    }

    return this.botsService.getDefaultActiveBot(companyId);
  }

  private shouldRespondToInbound(params: {
    configuration: BotConfigurationBundle;
    bot: BotEntity;
    channel: ChannelEntity;
    userMessage: string;
  }): { ok: boolean; reason: string } {
    if (!params.configuration.general.isEnabled) {
      return { ok: false, reason: 'bot_disabled_globally' };
    }
    if (!params.configuration.orchestrator.automaticMode) {
      return { ok: false, reason: 'automatic_mode_disabled' };
    }
    if (params.bot.status !== 'active') {
      return { ok: false, reason: 'bot_inactive' };
    }
    if (params.channel.status !== 'active') {
      return { ok: false, reason: 'channel_inactive' };
    }
    if (!params.userMessage.trim()) {
      return { ok: false, reason: 'empty_inbound_message' };
    }
    return { ok: true, reason: 'ready' };
  }

  private resolvePromptInputs(
    configuration: BotConfigurationBundle,
    bot: BotEntity,
    detectedIntent: string,
    activePrompts: PromptEntity[],
  ): {
    systemInstructions: string;
    mainBotPrompt: string;
    businessRules: string[];
  } {
    const systemInstructions =
      activePrompts.find((prompt) => prompt.type === 'system')?.content?.trim() ||
      configuration.prompts[0]?.content ||
      configuration.openai.systemPromptPreview;
    const mainBotPrompt = bot.systemPrompt?.trim() || systemInstructions;
    const promptTypes = this.resolvePromptTypesForIntent(detectedIntent);
    const businessRules = activePrompts
      .filter((prompt) => prompt.type === 'behavior' || promptTypes.includes(prompt.type))
      .map((prompt) => prompt.content.trim())
      .filter((value) => value.length > 0);

    return {
      systemInstructions,
      mainBotPrompt,
      businessRules,
    };
  }

  private resolvePromptTypesForIntent(detectedIntent: string): string[] {
    if (detectedIntent === 'support') {
      return ['support'];
    }
    return ['sales'];
  }

  private buildRecentTranscriptMessages(
    recentMessages: MessageEntity[],
  ): OpenAiChatMessage[] {
    const history = recentMessages.slice(-8);
    if (history.length === 0) {
      return [];
    }

    const currentInboundId =
      history.filter((message) => message.sender === 'client').slice(-1)[0]?.id ?? null;

    return history
      .filter((message) => message.id !== currentInboundId)
      .map((message) => ({
        role: message.sender === 'bot' ? 'assistant' : 'user',
        content: message.content,
      }));
  }

  private approximateTokenCount(chunks: string[]): number {
    const totalCharacters = chunks.reduce((sum, item) => sum + item.length, 0);
    return Math.max(1, Math.ceil(totalCharacters / 4));
  }

  private normalizeAssistantReply(params: {
    draft: string;
    userMessage: string;
    recentMessages: MessageEntity[];
    senderName: string | null;
  }): string {
    const trimmedDraft = params.draft.trim();
    const trimmedUserMessage = params.userMessage.trim();
    if (!trimmedDraft) {
      return this.buildNaturalShortReply(trimmedUserMessage, params.recentMessages, params.senderName);
    }

    const normalizedDraft = trimmedDraft.toLowerCase();
    const looksLikeGenericShortMessageReply =
      normalizedDraft.includes('mensaje es muy breve') ||
      normalizedDraft.includes('mensaje sigue siendo breve') ||
      normalizedDraft.includes('no proporciona suficiente información') ||
      normalizedDraft.includes('no proporciona suficiente informacion') ||
      normalizedDraft.includes('podrías darme más detalles') ||
      normalizedDraft.includes('podrias darme mas detalles');

    const lastAssistantMessage = [...params.recentMessages]
      .reverse()
      .find((message) => message.sender === 'bot')?.content.trim();
    const repeatsLastAssistant =
      !!lastAssistantMessage &&
      lastAssistantMessage.toLowerCase() == normalizedDraft;

    if (!looksLikeGenericShortMessageReply && !repeatsLastAssistant) {
      return trimmedDraft;
    }

    const fallback = this.buildNaturalShortReply(
      trimmedUserMessage,
      params.recentMessages,
      params.senderName,
    );
    return fallback || trimmedDraft;
  }

  private buildDeterministicReplyIfApplicable(params: {
    userMessage: string;
    recentMessages: MessageEntity[];
    senderName: string | null;
  }): string | null {
    const normalized = params.userMessage.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const isGreeting = /^(hola|buenas|buenos dias|buenos d[ií]as|buenas tardes|buenas noches|hey|ey)\b/.test(normalized);
    const isHowAreYou = /(como estas|c[oó]mo est[aá]s|que tal|q tal|todo bien)/.test(normalized);
    const isUltraShort = normalized.length <= 12;

    if (!isGreeting && !isHowAreYou && !isUltraShort) {
      return null;
    }

    return this.buildNaturalShortReply(
      params.userMessage,
      params.recentMessages,
      params.senderName,
    );
  }

  private buildNaturalShortReply(
    userMessage: string,
    recentMessages: MessageEntity[],
    senderName: string | null,
  ): string {
    const normalized = userMessage.toLowerCase();
    const trimmedSenderName = senderName?.trim() ?? '';
    const namePrefix = trimmedSenderName.length > 0 ? `${trimmedSenderName}, ` : '';
    const previousClientTopic = [...recentMessages]
      .reverse()
      .find((message) => message.sender === 'client' && message.content.trim() !== userMessage.trim())
      ?.content
      .trim();
    const shortPreviousTopic = previousClientTopic == null || previousClientTopic.length === 0
      ? null
      : previousClientTopic.length > 80
        ? `${previousClientTopic.slice(0, 77)}...`
        : previousClientTopic;

    if (/^(hola|buenas|buenos dias|buenos d[ií]as|buenas tardes|buenas noches|hey|ey)\b/.test(normalized)) {
      return shortPreviousTopic != null
        ? `Hola ${namePrefix}seguimos con lo que me comentabas sobre "${shortPreviousTopic}". ¿Qué necesitas ahora mismo?`
        : `Hola ${namePrefix}estoy aquí para ayudarte. ¿Qué necesitas?`;
    }

    if (/(como estas|c[oó]mo est[aá]s|que tal|q tal|todo bien)/.test(normalized)) {
      return shortPreviousTopic != null
        ? `Todo bien. Seguimos con "${shortPreviousTopic}" si quieres, o dime en qué te ayudo ahora.`
        : 'Todo bien. Dime en qué te ayudo y seguimos por ahí.';
    }

    if (normalized.length <= 12) {
      return shortPreviousTopic != null
        ? `Te sigo el hilo con "${shortPreviousTopic}". Cuéntame un poco más y te ayudo.`
        : `Claro ${namePrefix}cuéntame un poco más y te ayudo enseguida.`;
    }

    return `Entiendo. Cuéntame un poco más para ayudarte mejor con eso.`;
  }

  private async persistAiBrainLog(params: {
    companyId: string;
    conversationId: string;
    contactId: string;
    botId: string;
    channelId: string;
    status: string;
    detectedIntent: string | null;
    provider: string | null;
    model: string | null;
    latencyMs: number;
    metadata: Record<string, unknown>;
  }): Promise<void> {
    await this.aiBrainLogsRepository.save(this.aiBrainLogsRepository.create(params));
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

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  }
}