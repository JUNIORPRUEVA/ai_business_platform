import { Injectable, Logger, Optional } from '@nestjs/common';
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
import { MessageEntity, MessageSender } from '../../messages/entities/message.entity';
import { MessagesService } from '../../messages/messages.service';
import { OpenAiChatMessage, OpenAiDraftResponse } from '../../openai/types/openai.types';
import { OpenAiService } from '../../openai/services/openai.service';
import { PromptEntity } from '../../prompts/entities/prompt.entity';
import { PromptsService } from '../../prompts/prompts.service';
import { ToolEntity } from '../../tools/entities/tool.entity';
import { ToolsService } from '../../tools/tools.service';
import { WhatsappMessagingService } from '../../whatsapp-channel/services/whatsapp-messaging.service';
import { AiBrainLogEntity } from '../entities/ai-brain-log.entity';
import { KnowledgeDocumentEntity } from '../entities/knowledge-document.entity';
import { AiBrainAudioService } from './ai-brain-audio.service';
import { AiBrainCacheService } from './ai-brain-cache.service';
import { AiBrainContextBuilderService } from './ai-brain-context-builder.service';
import { AiBrainDocumentService } from './ai-brain-document.service';
import { AiBrainInboundDocumentService } from './ai-brain-inbound-document.service';
import { AiBrainImageService } from './ai-brain-image.service';
import { AiBrainToolRouterService } from './ai-brain-tool-router.service';
import { AiBrainVideoService } from './ai-brain-video.service';

@Injectable()
export class AiBrainService {
  private static readonly minimumResponseTemperature = 0.7;
  private static readonly responsePresencePenalty = 0.6;
  private static readonly responseFrequencyPenalty = 0.4;
  private static readonly aiResourceCacheTtlSeconds = 30;
  private static readonly mediaResolutionCacheTtlSeconds = 21_600;
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
    @Optional()
    private readonly aiBrainAudioService?: AiBrainAudioService,
    @Optional()
    private readonly aiBrainImageService?: AiBrainImageService,
    @Optional()
    private readonly aiBrainCacheService?: AiBrainCacheService,
    @Optional()
    private readonly aiBrainVideoService?: AiBrainVideoService,
    @Optional()
    private readonly aiBrainInboundDocumentService?: AiBrainInboundDocumentService,
  ) {}

  async processInboundMessage(params: {
    companyId: string;
    channelId: string;
    conversationId: string;
    contactPhone: string;
    remoteJid?: string;
    messageId: string;
  }): Promise<{ ok: true }> {
    const startedAt = Date.now();
    const configuration = await this.botConfigurationService.getConfiguration(
      params.companyId,
    );
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

      const [company, resolvedChannel, conversation, currentInboundMessage] = await Promise.all([
        this.companiesService.getMyCompany(params.companyId),
        this.channelsService.get(params.companyId, params.channelId),
        this.conversationsService.get(params.companyId, params.conversationId),
        this.messagesService.getById(
          params.companyId,
          params.conversationId,
          params.messageId,
        ),
      ]);
      channel = resolvedChannel;
      if (!currentInboundMessage) {
        throw new Error(
          `[AI BRAIN] inbound message not found conversationId=${params.conversationId} messageId=${params.messageId}`,
        );
      }
      const [contact, resolvedInboundMessage, recentMessages] = await Promise.all([
        this.contactsService.get(params.companyId, conversation.contactId),
        this.resolveInboundMessageContent(
          params.companyId,
          params.conversationId,
          currentInboundMessage,
        ),
        this.messagesService.listRecent(
          params.companyId,
          params.conversationId,
          Math.max(memoryWindowSize, 20),
        ),
      ]);
      contactId = contact.id;
      const userMessage = resolvedInboundMessage.content.trim();
      if (resolvedInboundMessage.type === 'audio') {
        this.logger.log(
          `[AI BRAIN] final text sent to AI conversationId=${params.conversationId} messageId=${params.messageId} text="${userMessage.slice(0, 160)}"`,
        );
      }
      const contactPhone = (params.contactPhone || contact.phone || '').trim();
      const outboundRemoteJid = (params.remoteJid || '').trim();

      bot = await this.resolveActiveBotCached(params.companyId, channel);
      this.logger.log(
        `[AI BRAIN] bot resolved botId=${bot.id} channelId=${channel.id} model=${bot.model}`,
      );
      if (this.hasFailedAudioTranscription(resolvedInboundMessage)) {
        await this.sendAudioTechnicalFailureResponse({
          companyId: params.companyId,
          conversationId: params.conversationId,
          messageId: params.messageId,
          contactId: contact.id,
          channelId: channel.id,
          botId: bot.id,
          botModel: bot.model,
          remoteJid: outboundRemoteJid || contactPhone,
        });
        return { ok: true };
      }

      detectedIntent = this.detectIntent(userMessage);
      const respondability = this.shouldRespondToInbound({
        configuration,
        bot,
        channel,
        sender: resolvedInboundMessage.sender,
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

      const activePromptsPromise = this.listActivePromptsCached(params.companyId);
      const promptInputs = this.resolvePromptInputs(
        configuration,
        bot,
        detectedIntent,
        await activePromptsPromise,
      );
      this.logger.log(
        `[AI BRAIN] prompt resolved systemSource=${promptInputs.systemSource} mainSource=${promptInputs.mainSource} rules=${promptInputs.businessRules.length}`,
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

      const activeToolsPromise = configuration.orchestrator.enableToolExecution
        ? this.listActiveToolsCached(params.companyId, bot.id)
        : Promise.resolve([] as ToolEntity[]);
      const [activeTools, assembledMemory, documents, contactMemoryMap] = await Promise.all([
        activeToolsPromise,
        this.memoryService.assembleContext({
          companyId: params.companyId,
          contactId: contact.id,
          conversationId: params.conversationId,
          recentWindowSize: memoryWindowSize,
          incomingMessage: userMessage,
        }),
        this.listAvailableDocumentsCached(params.companyId, bot.id),
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

      const recentTranscriptMessages = this.buildRecentTranscriptMessages(
        recentMessages,
        currentInboundMessage.id,
      );
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
      const openAiMessages = this.ensureValidOpenAiMessages(
        context.modelMessages,
        userMessage,
      );
      const approximatePromptTokens = this.approximateTokenCount(
        openAiMessages.map((item) => item.content),
      );
      this.logger.log(
        `[AI BRAIN] prompt built tokens=${approximatePromptTokens} messages=${openAiMessages.length}`,
      );

      const responseTemperature = this.resolveResponseTemperature(
        bot.temperature,
        configuration.openai.temperature,
      );

      let firstDraft: OpenAiDraftResponse = {
        provider: 'mock',
        model: bot.model,
        content: '',
        usedMockFallback: false,
        systemPrompt: promptInputs.systemInstructions,
      };
      let finalContent = '';
      let executedTool: { tool: string; ok: boolean; result: unknown } | null = null;

      this.logger.log(`[AI BRAIN] openai request started model=${bot.model}`);
      firstDraft = await this.openAiService.draftResponse({
        companyId: params.companyId,
        senderName: contact.name || undefined,
        detectedIntent,
        messages: openAiMessages,
        model: bot.model,
        temperature: responseTemperature,
        presencePenalty: AiBrainService.responsePresencePenalty,
        frequencyPenalty: AiBrainService.responseFrequencyPenalty,
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
          detectedIntent,
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
          companyId: params.companyId,
          senderName: contact.name || undefined,
          detectedIntent,
          model: bot.model,
          temperature: responseTemperature,
          presencePenalty: AiBrainService.responsePresencePenalty,
          frequencyPenalty: AiBrainService.responseFrequencyPenalty,
          maxTokens: configuration.openai.maxTokens,
          messages: [
            ...openAiMessages,
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

      finalContent = this.normalizeAssistantReply({
        draft: finalContent,
        userMessage,
        recentMessages,
        senderName: contact.name || null,
        detectedIntent,
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
        const targetRemoteJid = outboundRemoteJid || contactPhone;
        if (!targetRemoteJid) {
          this.logger.warn(
            `[AI BRAIN] whatsapp send skipped conversationId=${params.conversationId} reason=missing_response_target`,
          );
        } else {
          const outboundDispatch = await this.whatsappMessagingService.sendText(
            params.companyId,
            {
              remoteJid: targetRemoteJid,
              text: botMessage.content,
            },
          );
          const outboundMessageView = this.readRecord(outboundDispatch['message']);
          outboundTransportMessageId = this.readString(outboundMessageView['id']) || null;
          this.logger.log(
            `[AI BRAIN] whatsapp send success conversationId=${params.conversationId} target=${targetRemoteJid} whatsappMessageId=${outboundTransportMessageId ?? 'n/a'}`,
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
          promptSource: {
            system: promptInputs.systemSource,
            main: promptInputs.mainSource,
          },
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
      const role = this.mapSenderToOpenAiRole(message.sender as MessageSender);
      if (!role) {
        continue;
      }
      const content = message.content.trim();
      if (!content) {
        continue;
      }
      await this.memoryService.appendConversationMemory({
        companyId,
        contactId,
        conversationId,
        role,
        content,
        contentType: 'text',
        metadataJson: {},
        source: role === 'assistant' ? 'assistant_response' : 'inbound_message',
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

  private async resolveActiveBotCached(
    companyId: string,
    channel: ChannelEntity,
  ): Promise<BotEntity> {
    const configuredBotId = this.readString(channel.config['botId']) || 'default';
    const cacheKey = this.buildAiCacheKey('bot', companyId, channel.id, configuredBotId);
    const cached = await this.aiBrainCacheService?.getJson<BotEntity>(cacheKey);
    if (cached) {
      return cached;
    }

    const resolved = await this.resolveActiveBot(companyId, channel);
    await this.aiBrainCacheService?.setJson(
      cacheKey,
      resolved,
      AiBrainService.aiResourceCacheTtlSeconds,
    );
    return resolved;
  }

  private async listActivePromptsCached(companyId: string): Promise<PromptEntity[]> {
    const cacheKey = this.buildAiCacheKey('prompts', companyId);
    const cached = await this.aiBrainCacheService?.getJson<PromptEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const resolved = await this.promptsService.listActive(companyId);
    await this.aiBrainCacheService?.setJson(
      cacheKey,
      resolved,
      AiBrainService.aiResourceCacheTtlSeconds,
    );
    return resolved;
  }

  private async listActiveToolsCached(companyId: string, botId: string): Promise<ToolEntity[]> {
    const cacheKey = this.buildAiCacheKey('tools', companyId, botId);
    const cached = await this.aiBrainCacheService?.getJson<ToolEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const resolved = await this.listActiveTools(companyId, botId);
    await this.aiBrainCacheService?.setJson(
      cacheKey,
      resolved,
      AiBrainService.aiResourceCacheTtlSeconds,
    );
    return resolved;
  }

  private async listAvailableDocumentsCached(
    companyId: string,
    botId: string,
  ): Promise<KnowledgeDocumentEntity[]> {
    const cacheKey = this.buildAiCacheKey('documents', companyId, botId);
    const cached = await this.aiBrainCacheService?.getJson<KnowledgeDocumentEntity[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const resolved = await this.aiBrainDocumentService.listAvailable(companyId, botId);
    await this.aiBrainCacheService?.setJson(
      cacheKey,
      resolved,
      AiBrainService.aiResourceCacheTtlSeconds,
    );
    return resolved;
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
    sender: MessageSender;
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
    if (params.sender === 'bot') {
      return { ok: false, reason: 'bot_message_ignored' };
    }
    if (!params.userMessage.trim()) {
      return { ok: false, reason: 'empty_inbound_message' };
    }
    if (this.isLegacyAudioPlaceholder(params.userMessage)) {
      return { ok: false, reason: 'audio_placeholder_ignored' };
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
    systemSource: string;
    mainSource: string;
  } {
    const configuredPrimaryPrompt =
      configuration.prompts
        .map((prompt) => prompt.content.trim())
        .find((content) => content.length > 0) || '';
    const activeSystemPrompt =
      activePrompts.find((prompt) => prompt.type === 'system')?.content?.trim() || '';
    const previewSystemPrompt = configuration.openai.systemPromptPreview.trim();

    const systemInstructions =
      configuredPrimaryPrompt || activeSystemPrompt || previewSystemPrompt;
    const systemSource = configuredPrimaryPrompt
      ? 'bot_configuration.prompts[0]'
      : activeSystemPrompt
        ? 'prompts.system.active'
        : 'openai.systemPromptPreview';

    const botSystemPrompt = bot.systemPrompt?.trim() || '';
    const mainBotPrompt = configuredPrimaryPrompt || botSystemPrompt || systemInstructions;
    const mainSource = configuredPrimaryPrompt
      ? 'bot_configuration.prompts[0]'
      : botSystemPrompt
        ? 'bots.systemPrompt'
        : systemSource;
    const promptTypes = this.resolvePromptTypesForIntent(detectedIntent);
    const configuredBusinessRules = configuration.prompts
      .slice(1)
      .map((prompt) => prompt.content.trim())
      .filter((value) => value.length > 0);
    const dynamicBusinessRules = activePrompts
      .filter((prompt) => prompt.type === 'behavior' || promptTypes.includes(prompt.type))
      .map((prompt) => prompt.content.trim())
      .filter((value) => value.length > 0);
    const behaviorGuardrails = [
      'Siempre responde primero la pregunta real del usuario antes de intentar vender o guiar la conversación.',
      'Después de responder, guía la conversación de forma natural hacia el siguiente paso comercial.',
      'Responde como una persona real por WhatsApp, no como soporte genérico ni como folleto.',
      'Usa normalmente 1 o 2 frases cortas; evita párrafos largos.',
      'No uses lenguaje técnico, rebuscado o demasiado formal si el cliente no lo pide.',
      'Haz como máximo una pregunta corta para mover la conversación.',
      'Nunca saltes directamente al registro o captura de datos si el usuario no lo pidió explícitamente.',
      'Nunca repitas en bloque "nombre, teléfono, email" ni solicites esos datos sin contexto.',
      'Si el usuario pregunta qué venden, explica productos o servicios primero.',
      'Si el usuario pregunta dónde están, responde con ubicación primero.',
      'Si el usuario pregunta por precio o costos, responde con precio, rango o forma de cotizar primero.',
    ];
    const businessRules = [
      ...new Set([
        ...behaviorGuardrails,
        ...configuredBusinessRules,
        ...dynamicBusinessRules,
      ]),
    ];

    return {
      systemInstructions,
      mainBotPrompt,
      businessRules,
      systemSource,
      mainSource,
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
    currentInboundId: string,
  ): OpenAiChatMessage[] {
    const history = [...recentMessages]
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .slice(-8);
    if (history.length === 0) {
      return [];
    }

    return history
      .filter((message) => message.id !== currentInboundId)
      .map((message) => {
        const role = this.mapSenderToOpenAiRole(message.sender);
        if (!role) {
          return null;
        }

        const content = message.content.trim();
        if (!content) {
          return null;
        }

        return {
          role,
          content,
        };
      })
      .filter((message): message is OpenAiChatMessage => message != null);
  }

  private ensureValidOpenAiMessages(
    messages: OpenAiChatMessage[],
    latestUserMessage: string,
  ): OpenAiChatMessage[] {
    if (!latestUserMessage.trim()) {
      return [];
    }

    const sanitizedMessages = messages
      .map((message) => ({
        role: message.role,
        content: message.content.trim(),
      }))
      .filter((message) => message.content.length > 0);

    const lastMessage = sanitizedMessages[sanitizedMessages.length - 1];
    if (!lastMessage) {
      throw new Error('[AI BRAIN] no messages were assembled for OpenAI');
    }
    if (lastMessage.role !== 'user') {
      throw new Error(
        `[AI BRAIN] latest openai message must be from user but received role=${lastMessage.role}`,
      );
    }
    if (lastMessage.content !== latestUserMessage.trim()) {
      throw new Error('[AI BRAIN] latest user message mismatch before OpenAI call');
    }

    return sanitizedMessages;
  }

  private mapSenderToOpenAiRole(sender: MessageSender): OpenAiChatMessage['role'] | null {
    if (sender === 'client') {
      return 'user';
    }
    if (sender === 'bot') {
      return 'assistant';
    }
    return null;
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
    detectedIntent: string;
  }): string {
    const trimmedDraft = params.draft.trim();
    const trimmedUserMessage = params.userMessage.trim();
    const recentVideoContext = this.extractRecentVideoContext(
      params.recentMessages,
      trimmedUserMessage,
    );
    const userAskedAboutVideo = this.isVideoQuestion(trimmedUserMessage);
    if (!trimmedDraft) {
      return this.buildHumanSalesReply({
        userMessage: trimmedUserMessage,
        recentMessages: params.recentMessages,
        senderName: params.senderName,
        detectedIntent: params.detectedIntent,
      });
    }

    const conversationalDraft = this.enforceConversationalStyle(trimmedDraft);
    const normalizedDraft = conversationalDraft.toLowerCase();
    const looksLikeGenericShortMessageReply =
      normalizedDraft.includes('mensaje es muy breve') ||
      normalizedDraft.includes('mensaje sigue siendo breve') ||
      normalizedDraft.includes('no proporciona suficiente información') ||
      normalizedDraft.includes('no proporciona suficiente informacion') ||
      normalizedDraft.includes('podrías darme más detalles') ||
      normalizedDraft.includes('podrias darme mas detalles');

    const soundsRobotic =
      normalizedDraft.includes('recibimos tu') ||
      normalizedDraft.includes('la estamos procesando') ||
      normalizedDraft.includes('un asesor puede continuar') ||
      normalizedDraft.includes('respuesta inmediata con datos exactos') ||
      normalizedDraft.includes('gracias por la descripción detallada') ||
      normalizedDraft.includes('gracias por la descripcion detallada') ||
      normalizedDraft.includes('si te interesa, puedo ayudarte a buscar más información') ||
      normalizedDraft.includes('si te interesa, puedo ayudarte a buscar mas informacion') ||
      normalizedDraft.includes('además, si buscas soluciones tecnológicas') ||
      normalizedDraft.includes('ademas, si buscas soluciones tecnologicas') ||
      normalizedDraft.includes('estoy aquí para ayudarte') ||
      normalizedDraft.includes('estoy aqui para ayudarte') ||
      normalizedDraft.includes('no puedo transcribir el contenido del video') ||
      normalizedDraft.includes('no puedo analizarlo directamente') ||
      normalizedDraft.includes('si hay algo específico que te gustaría saber') ||
      normalizedDraft.includes('si hay algo especifico que te gustaria saber') ||
      normalizedDraft.includes('nombre, teléfono, email') ||
      normalizedDraft.includes('nombre, telefono, email');

    const isTooLong =
      conversationalDraft.length > 280 ||
      conversationalDraft.split(/\n+/).filter((chunk) => chunk.trim().length > 0).length > 2;

    const lastAssistantMessage = [...params.recentMessages]
      .reverse()
      .find((message) => message.sender === 'bot')?.content.trim();
    const repeatsLastAssistant =
      !!lastAssistantMessage &&
      lastAssistantMessage.toLowerCase() == normalizedDraft;

    if (userAskedAboutVideo && recentVideoContext != null) {
      return this.buildVideoAwareReply(trimmedUserMessage, recentVideoContext);
    }

    if (!looksLikeGenericShortMessageReply && !soundsRobotic && !repeatsLastAssistant && !isTooLong) {
      return conversationalDraft;
    }

    const fallback = this.buildHumanSalesReply({
      userMessage: trimmedUserMessage,
      recentMessages: params.recentMessages,
      senderName: params.senderName,
      detectedIntent: params.detectedIntent,
    });
    return fallback || conversationalDraft;
  }

  private buildHumanSalesReply(params: {
    userMessage: string;
    recentMessages: MessageEntity[];
    senderName: string | null;
    detectedIntent: string;
  }): string {
    const normalized = params.userMessage.toLowerCase().trim();
    const recentVideoContext = this.extractRecentVideoContext(
      params.recentMessages,
      params.userMessage,
    );
    const trimmedSenderName = params.senderName?.trim() ?? '';
    const namePrefix = trimmedSenderName.length > 0 ? `${trimmedSenderName}, ` : '';
    const previousClientTopic = [...params.recentMessages]
      .reverse()
      .find((message) => message.sender === 'client' && message.content.trim() !== params.userMessage.trim())
      ?.content
      .trim();
    const shortPreviousTopic = previousClientTopic == null || previousClientTopic.length === 0
      ? null
      : previousClientTopic.length > 80
        ? `${previousClientTopic.slice(0, 77)}...`
        : previousClientTopic;

    if (!normalized) {
      return 'Hola. Dime qué necesitas y te ayudo rápido.';
    }

    if (this.isVideoQuestion(normalized) && recentVideoContext != null) {
      return this.buildVideoAwareReply(normalized, recentVideoContext);
    }

    if (/^(hola|buenas|buenos dias|buenos d[ií]as|buenas tardes|buenas noches|hey|ey)\b/.test(normalized)) {
      return shortPreviousTopic != null
        ? `Hola ${namePrefix}seguimos con ${shortPreviousTopic}. ¿Quieres precio o más detalles?`
        : `Hola ${namePrefix}¿qué estás buscando?`;
    }

    if (/(como estas|c[oó]mo est[aá]s|que tal|q tal|todo bien)/.test(normalized)) {
      return shortPreviousTopic != null
        ? `Todo bien. Seguimos con ${shortPreviousTopic}. ¿Te paso precio o detalles?`
        : 'Todo bien. Dime qué necesitas.';
    }

    if (/^(si|sí|ok|oki|dale|perfecto|de acuerdo|claro|yes)\b/.test(normalized)) {
      return shortPreviousTopic != null
        ? `Perfecto. Sobre ${shortPreviousTopic}, ¿quieres precio o detalles?`
        : 'Perfecto. ¿Quieres precio o más detalles?';
    }

    if (/(que venden|qué venden|que ofrecen|qué ofrecen|productos|servicios)/.test(normalized)) {
      return 'Te cuento sin problema. Dime qué buscas y te recomiendo la mejor opción.';
    }

    if (/(donde estan|dónde están|ubicacion|ubicación|direccion|dirección)/.test(normalized)) {
      return 'Claro. Te paso la ubicación enseguida.';
    }

    if (/(precio|precios|cu[aá]nto cuesta|cu[aá]nto vale|costo|costos|cotiz)/.test(normalized)) {
      return 'Claro. Dime cuál te interesa y te paso el precio.';
    }

    if (normalized.length <= 12) {
      if (params.detectedIntent === 'pricing') {
        return 'Claro. Dime cuál te interesa y te paso el precio.';
      }
      return shortPreviousTopic != null
        ? `Seguimos con ${shortPreviousTopic}. ¿Quieres precio, detalles o disponibilidad?`
        : `Claro ${namePrefix}¿quieres precio, detalles o disponibilidad?`;
    }

    if (params.detectedIntent === 'pricing') {
      return 'Perfecto. Dime cuál te interesa y te cotizo.';
    }

    if (params.detectedIntent === 'support') {
      return 'Entiendo. Dime qué te está fallando y lo revisamos.';
    }

    return shortPreviousTopic != null
      ? `Entiendo. Seguimos con ${shortPreviousTopic}. ¿Quieres que te recomiende algo?`
      : 'Entiendo. ¿Quieres que te recomiende una opción?';
  }

  private isVideoQuestion(message: string): boolean {
    const normalized = message.toLowerCase().trim();
    return /(video|vídeo)/.test(normalized) &&
      /(que dice|qué dice|que muestra|qué muestra|de que trata|de qué trata|que sale|qué sale|explica|cuentame|cuéntame|resume|resumen)/.test(normalized);
  }

  private extractRecentVideoContext(
    recentMessages: MessageEntity[],
    currentUserMessage?: string,
  ): { summary: string; transcript: string | null } | null {
    const chronologicalMessages = [...recentMessages].sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );
    const normalizedCurrentUserMessage = currentUserMessage?.trim() ?? '';
    const lastClientMessageIndex = this.findLastClientMessageIndex(
      chronologicalMessages,
      normalizedCurrentUserMessage,
    );

    if (lastClientMessageIndex >= 0) {
      for (let index = lastClientMessageIndex - 1; index >= 0; index -= 1) {
        const context = this.readVideoContextFromMessage(chronologicalMessages[index]);
        if (context != null) {
          return context;
        }
      }
    }

    for (let index = chronologicalMessages.length - 1; index >= 0; index -= 1) {
      const context = this.readVideoContextFromMessage(chronologicalMessages[index]);
      if (context != null) {
        return context;
      }
    }

    return null;
  }

  private findLastClientMessageIndex(
    recentMessages: MessageEntity[],
    currentUserMessage: string,
  ): number {
    for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
      const message = recentMessages[index];
      if (message.sender !== 'client') {
        continue;
      }

      const content = message.content.trim();
      if (currentUserMessage.length === 0 || content === currentUserMessage) {
        return index;
      }
    }

    for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
      if (recentMessages[index].sender === 'client') {
        return index;
      }
    }

    return -1;
  }

  private readVideoContextFromMessage(
    message: MessageEntity,
  ): { summary: string; transcript: string | null } | null {
    if (message.sender !== 'client' || message.type !== 'video') {
      return null;
    }

    const analysis = this.readRecord(message.metadata?.['videoAnalysis']);
    const status = this.readString(analysis['status']);
    if (status !== 'completed') {
      return null;
    }

    const summary =
      this.readString(analysis['text']) ||
      this.readString(analysis['content']) ||
      message.content.trim();
    if (!summary) {
      return null;
    }

    const transcript = this.readString(analysis['transcript']) || null;
    return {
      summary: this.compactVideoSummary(summary),
      transcript: transcript ? this.compactTranscriptSummary(transcript) : null,
    };
  }

  private compactVideoSummary(summary: string): string {
    const cleaned = summary
      .replace(/contexto del cliente:\s*/gi, '')
      .replace(/resumen del video:\s*/gi, '')
      .replace(/transcripci(?:o|ó)n detectada en el video:\s*/gi, '')
      .replace(/an(?:a|á)lisis del video:?\s*/gi, '')
      .replace(/inicio del video:?\s*/gi, '')
      .replace(/fotograma\s*\d+\s*:?/gi, '')
      .replace(/descripci(?:o|ó)n\s*:?/gi, '')
      .replace(/introducci(?:o|ó)n\s*:?/gi, '')
      .replace(/\b\d+\.\s*/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0)
      .slice(0, 2)
      .join(' ');
  }

  private compactTranscriptSummary(summary: string): string {
    return summary
      .replace(/transcripci(?:o|ó)n detectada en el video:\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0)
      .slice(0, 2)
      .join(' ');
  }

  private buildVideoAwareReply(
    userMessage: string,
    videoContext: { summary: string; transcript: string | null },
  ): string {
    const normalized = userMessage.toLowerCase();
    if (/(que dice|qu(?:e|é) dice|audio|voz|hablan|dicen)/.test(normalized) && videoContext.transcript) {
      return this.buildVideoAnswerReply('En el audio del video se entiende', videoContext.transcript);
    }

    return this.buildVideoAnswerReply('En ese video se ve', videoContext.summary);
  }

  private buildVideoAnswerReply(prefix: string, content: string): string {
    const trimmedContent = content.trim().replace(/[.\s]+$/g, '');
    if (!trimmedContent) {
      return `${prefix}.`;
    }

    const loweredContent = trimmedContent.charAt(0).toLowerCase() + trimmedContent.slice(1);
    if (/^(se ve|se escucha|aparece|muestra|sale|hablan de|dicen|est(?:a|á))\b/i.test(trimmedContent)) {
      const normalizedPrefix = prefix.replace(/\s+se ve$/i, '');
      return `${normalizedPrefix} ${loweredContent}.`;
    }

    return `${prefix} ${loweredContent}.`;
  }

  private enforceConversationalStyle(draft: string): string {
    const flattened = draft
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const sentences = flattened
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);

    const shortened = sentences.length <= 2
      ? sentences.join(' ')
      : sentences.slice(0, 2).join(' ');

    return shortened
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([,.!?])/g, '$1')
      .trim();
  }

  private resolveResponseTemperature(
    botTemperature: number | null | undefined,
    configuredTemperature: number | null | undefined,
  ): number {
    return Math.max(
      AiBrainService.minimumResponseTemperature,
      botTemperature ?? 0,
      configuredTemperature ?? 0,
    );
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

  private buildAiCacheKey(scope: string, ...parts: string[]): string {
    return ['ai_brain', scope, ...parts.map((part) => part.trim()).filter(Boolean)].join(':');
  }

  private readResolvedAudioText(
    message: MessageEntity,
  ): { content: string; metadataPatch: Record<string, unknown> } | null {
    const transcription = this.readRecord(message.metadata?.['audioTranscription']);
    const status = this.readString(transcription['status']);
    if (status === 'completed') {
      const text = this.readString(transcription['text']);
      if (!text) {
        return null;
      }

      return {
        content: text,
        metadataPatch: {
          audioTranscription: transcription,
        },
      };
    }

    if (status === 'failed') {
      const fallback = this.readString(transcription['fallback']);
      if (!fallback) {
        return null;
      }

      return {
        content: fallback,
        metadataPatch: {
          audioTranscription: transcription,
        },
      };
    }

    return null;
  }

  private readResolvedImageText(
    message: MessageEntity,
  ): { content: string; metadataPatch: Record<string, unknown> } | null {
    const analysis = this.readRecord(message.metadata?.['imageAnalysis']);
    const status = this.readString(analysis['status']);
    if (status === 'completed') {
      const content = this.readString(analysis['content']) || this.readString(analysis['text']);
      if (!content) {
        return null;
      }

      return {
        content,
        metadataPatch: {
          imageAnalysis: analysis,
        },
      };
    }

    if (status === 'failed') {
      const content = this.readString(analysis['content']) || this.readString(analysis['fallback']);
      if (!content) {
        return null;
      }

      return {
        content,
        metadataPatch: {
          imageAnalysis: analysis,
        },
      };
    }

    return null;
  }

  private readResolvedVideoText(
    message: MessageEntity,
  ): { content: string; metadataPatch: Record<string, unknown> } | null {
    const analysis = this.readRecord(message.metadata?.['videoAnalysis']);
    const status = this.readString(analysis['status']);
    if (status === 'completed') {
      const content = this.readString(analysis['content']) || this.readString(analysis['text']);
      if (!content) {
        return null;
      }

      return {
        content,
        metadataPatch: {
          videoAnalysis: analysis,
        },
      };
    }

    if (status === 'failed') {
      const content = this.readString(analysis['content']) || this.readString(analysis['fallback']);
      if (!content) {
        return null;
      }

      return {
        content,
        metadataPatch: {
          videoAnalysis: analysis,
        },
      };
    }

    return null;
  }

  private readResolvedDocumentText(
    message: MessageEntity,
  ): { content: string; metadataPatch: Record<string, unknown> } | null {
    const analysis = this.readRecord(message.metadata?.['documentAnalysis']);
    const status = this.readString(analysis['status']);
    if (status === 'completed') {
      const content = this.readString(analysis['content']) || this.readString(analysis['text']);
      if (!content) {
        return null;
      }

      return {
        content,
        metadataPatch: {
          documentAnalysis: analysis,
        },
      };
    }

    if (status === 'failed') {
      const content = this.readString(analysis['content']) || this.readString(analysis['fallback']);
      if (!content) {
        return null;
      }

      return {
        content,
        metadataPatch: {
          documentAnalysis: analysis,
        },
      };
    }

    return null;
  }

  private async persistResolvedInboundMediaMessage(
    companyId: string,
    conversationId: string,
    message: MessageEntity,
    resolution: { content: string; metadataPatch: Record<string, unknown> },
  ): Promise<MessageEntity> {
    const mergedMetadata = {
      ...(message.metadata ?? {}),
      ...resolution.metadataPatch,
    };
    const shouldPersist =
      message.content !== resolution.content ||
      JSON.stringify(message.metadata ?? {}) !== JSON.stringify(mergedMetadata);

    if (!shouldPersist) {
      return {
        ...message,
        content: resolution.content,
        metadata: mergedMetadata,
      };
    }

    return this.messagesService.updateMessageContent(
      companyId,
      conversationId,
      message.id,
      {
        content: resolution.content,
        metadata: mergedMetadata,
      },
    );
  }

  private hasFailedAudioTranscription(message: MessageEntity): boolean {
    if (message.type !== 'audio') {
      return false;
    }

    const transcription = this.readRecord(message.metadata?.['audioTranscription']);
    return this.readString(transcription['status']) === 'failed';
  }

  private async sendAudioTechnicalFailureResponse(params: {
    companyId: string;
    conversationId: string;
    messageId: string;
    contactId: string;
    channelId: string;
    botId: string;
    botModel: string;
    remoteJid: string;
  }): Promise<void> {
    const content =
      'Recib\u00ed tu audio, pero hubo un problema t\u00e9cnico proces\u00e1ndolo.';
    const botMessage = await this.messagesService.create(params.companyId, params.conversationId, {
      sender: 'bot',
      content,
      type: 'text',
      metadata: {
        source: 'audio-processing-failure',
      },
    });

    let outboundTransportMessageId: string | null = null;
    if (params.remoteJid.trim()) {
      const outboundDispatch = await this.whatsappMessagingService.sendText(params.companyId, {
        remoteJid: params.remoteJid,
        text: content,
      });
      const outboundMessageView = this.readRecord(outboundDispatch['message']);
      outboundTransportMessageId = this.readString(outboundMessageView['id']) || null;
    } else {
      this.logger.warn(
        `[AI BRAIN] audio technical fallback send skipped conversationId=${params.conversationId} reason=missing_response_target`,
      );
    }

    this.logger.warn(
      `[AI BRAIN] audio technical fallback sent conversationId=${params.conversationId} inboundMessageId=${params.messageId} outboundMessageId=${botMessage.id} transportMessageId=${outboundTransportMessageId ?? 'n/a'}`,
    );

    await this.persistAiBrainLog({
      companyId: params.companyId,
      conversationId: params.conversationId,
      contactId: params.contactId,
      botId: params.botId,
      channelId: params.channelId,
      status: 'processed',
      detectedIntent: 'audio_processing_failure',
      provider: null,
      model: params.botModel,
      latencyMs: 0,
      metadata: {
        messageId: params.messageId,
        outboundMessageId: botMessage.id,
        outboundTransportMessageId,
        path: 'audio_processing_failure',
      },
    });
  }

  private isLegacyAudioPlaceholder(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    return normalized === 'audio recibido';
  }

  private isAudioFallbackPlaceholder(content: string): boolean {
    const normalized = content.trim().toLowerCase();
    return normalized.includes('recibí tu audio') ||
      normalized.includes('recibi tu audio') ||
      normalized.includes('audio recibido');
  }

  private async resolveInboundMessageContent(
    companyId: string,
    conversationId: string,
    message: MessageEntity,
  ): Promise<MessageEntity> {
    if (message.type === 'document') {
      if (!this.aiBrainInboundDocumentService) {
        return message;
      }

      const existingDocumentResolution = this.readResolvedDocumentText(message);
      if (existingDocumentResolution) {
        return this.persistResolvedInboundMediaMessage(
          companyId,
          conversationId,
          message,
          existingDocumentResolution,
        );
      }

      const documentCacheKey = this.buildAiCacheKey('document-resolution', companyId, message.id);
      const cachedDocumentResolution =
        await this.aiBrainCacheService?.getJson<{
          content: string;
          metadataPatch: Record<string, unknown>;
        }>(documentCacheKey);
      if (cachedDocumentResolution?.content?.trim()) {
        return this.persistResolvedInboundMediaMessage(
          companyId,
          conversationId,
          message,
          cachedDocumentResolution,
        );
      }

      const documentResolution =
        await this.aiBrainInboundDocumentService.resolveInboundDocumentText({
          companyId,
          message,
        });
      await this.aiBrainCacheService?.setJson(
        documentCacheKey,
        documentResolution,
        AiBrainService.mediaResolutionCacheTtlSeconds,
      );

      return this.persistResolvedInboundMediaMessage(
        companyId,
        conversationId,
        message,
        documentResolution,
      );
    }

    if (message.type === 'video') {
      if (!this.aiBrainVideoService) {
        return message;
      }

      const existingVideoResolution = this.readResolvedVideoText(message);
      if (existingVideoResolution) {
        return this.persistResolvedInboundMediaMessage(
          companyId,
          conversationId,
          message,
          existingVideoResolution,
        );
      }

      const videoCacheKey = this.buildAiCacheKey('video-resolution', companyId, message.id);
      const cachedVideoResolution =
        await this.aiBrainCacheService?.getJson<{
          content: string;
          metadataPatch: Record<string, unknown>;
        }>(videoCacheKey);
      if (cachedVideoResolution?.content?.trim()) {
        return this.persistResolvedInboundMediaMessage(
          companyId,
          conversationId,
          message,
          cachedVideoResolution,
        );
      }

      const videoResolution = await this.aiBrainVideoService.resolveInboundVideoText({
        companyId,
        message,
      });
      await this.aiBrainCacheService?.setJson(
        videoCacheKey,
        videoResolution,
        AiBrainService.mediaResolutionCacheTtlSeconds,
      );

      return this.persistResolvedInboundMediaMessage(
        companyId,
        conversationId,
        message,
        videoResolution,
      );
    }

    if (message.type === 'image') {
      if (!this.aiBrainImageService) {
        return message;
      }

      const existingImageResolution = this.readResolvedImageText(message);
      if (existingImageResolution) {
        return this.persistResolvedInboundMediaMessage(
          companyId,
          conversationId,
          message,
          existingImageResolution,
        );
      }

      const imageCacheKey = this.buildAiCacheKey('image-resolution', companyId, message.id);
      const cachedImageResolution =
        await this.aiBrainCacheService?.getJson<{
          content: string;
          metadataPatch: Record<string, unknown>;
        }>(imageCacheKey);
      if (cachedImageResolution?.content?.trim()) {
        return this.persistResolvedInboundMediaMessage(
          companyId,
          conversationId,
          message,
          cachedImageResolution,
        );
      }

      const imageResolution = await this.aiBrainImageService.resolveInboundImageText({
        companyId,
        message,
      });
      await this.aiBrainCacheService?.setJson(
        imageCacheKey,
        imageResolution,
        AiBrainService.mediaResolutionCacheTtlSeconds,
      );

      return this.persistResolvedInboundMediaMessage(
        companyId,
        conversationId,
        message,
        imageResolution,
      );
    }

    if (message.type !== 'audio') {
      return message;
    }

    if (!this.aiBrainAudioService) {
      return message;
    }

    const existingResolution = this.readResolvedAudioText(message);
    if (existingResolution) {
      return this.persistResolvedInboundMediaMessage(
        companyId,
        conversationId,
        message,
        existingResolution,
      );
    }

    const cacheKey = this.buildAiCacheKey('audio-resolution', companyId, message.id);
    const cachedResolution =
      await this.aiBrainCacheService?.getJson<{
        content: string;
        metadataPatch: Record<string, unknown>;
      }>(cacheKey);
    if (cachedResolution?.content?.trim()) {
      return this.persistResolvedInboundMediaMessage(
        companyId,
        conversationId,
        message,
        cachedResolution,
      );
    }

    const resolution = await this.aiBrainAudioService.resolveInboundAudioText({
      companyId,
      message,
    });

    await this.aiBrainCacheService?.setJson(
      cacheKey,
      resolution,
      AiBrainService.mediaResolutionCacheTtlSeconds,
    );

    return this.persistResolvedInboundMediaMessage(
      companyId,
      conversationId,
      message,
      resolution,
    );
  }
}
