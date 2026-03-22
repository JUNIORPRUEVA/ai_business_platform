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
import { AiBrainContextBuilderService } from './ai-brain-context-builder.service';
import { AiBrainDocumentService } from './ai-brain-document.service';
import { AiBrainToolRouterService } from './ai-brain-tool-router.service';

@Injectable()
export class AiBrainService {
  private static readonly minimumResponseTemperature = 0.7;
  private static readonly responsePresencePenalty = 0.6;
  private static readonly responseFrequencyPenalty = 0.4;
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
    remoteJid?: string;
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

      const currentInboundMessage = await this.messagesService.getById(
        params.companyId,
        params.conversationId,
        params.messageId,
      );
      if (!currentInboundMessage) {
        throw new Error(
          `[AI BRAIN] inbound message not found conversationId=${params.conversationId} messageId=${params.messageId}`,
        );
      }
      if (currentInboundMessage.sender !== 'client') {
        throw new Error(
          `[AI BRAIN] latest message must be from user conversationId=${params.conversationId} messageId=${params.messageId} sender=${currentInboundMessage.sender}`,
        );
      }

      const recentMessages = await this.messagesService.listRecent(
        params.companyId,
        params.conversationId,
        Math.max(memoryWindowSize, 20),
      );
      const userMessage = currentInboundMessage?.content?.trim() || '';
      const contactPhone = (params.contactPhone || contact.phone || '').trim();
      const outboundRemoteJid = (params.remoteJid || '').trim();

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

      console.log('LATEST USER MESSAGE:', userMessage);
      console.log('ALL MESSAGES:', openAiMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })));
      console.log('[AI DEBUG] finalPrompt:', openAiMessages);
      this.logger.log(`[AI BRAIN] openai request started model=${bot.model}`);
      firstDraft = await this.openAiService.draftResponse({
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
      console.log('[AI DEBUG] response:', finalContent);

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
          console.log('SENDING TO:', targetRemoteJid);
          console.log('MESSAGE:', botMessage.content);
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
    if (!trimmedDraft) {
      return this.buildHumanSalesReply({
        userMessage: trimmedUserMessage,
        recentMessages: params.recentMessages,
        senderName: params.senderName,
        detectedIntent: params.detectedIntent,
      });
    }

    const normalizedDraft = trimmedDraft.toLowerCase();
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
      normalizedDraft.includes('respuesta inmediata con datos exactos');

    const lastAssistantMessage = [...params.recentMessages]
      .reverse()
      .find((message) => message.sender === 'bot')?.content.trim();
    const repeatsLastAssistant =
      !!lastAssistantMessage &&
      lastAssistantMessage.toLowerCase() == normalizedDraft;

    if (!looksLikeGenericShortMessageReply && !soundsRobotic && !repeatsLastAssistant) {
      return trimmedDraft;
    }

    const fallback = this.buildHumanSalesReply({
      userMessage: trimmedUserMessage,
      recentMessages: params.recentMessages,
      senderName: params.senderName,
      detectedIntent: params.detectedIntent,
    });
    return fallback || trimmedDraft;
  }

  private buildHumanSalesReply(params: {
    userMessage: string;
    recentMessages: MessageEntity[];
    senderName: string | null;
    detectedIntent: string;
  }): string {
    const normalized = params.userMessage.toLowerCase().trim();
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
      return 'Hola 👋 Estoy aquí para ayudarte. Si quieres, te muestro opciones, precios o disponibilidad.';
    }

    if (/^(hola|buenas|buenos dias|buenos d[ií]as|buenas tardes|buenas noches|hey|ey)\b/.test(normalized)) {
      return shortPreviousTopic != null
        ? `Hola ${namePrefix}seguimos con ${shortPreviousTopic}. ¿Quieres que te muestre opciones, precios o disponibilidad?`
        : `Hola ${namePrefix}👋 ¿Qué estás buscando hoy? Tengo varias opciones que podrían interesarte.`;
    }

    if (/(como estas|c[oó]mo est[aá]s|que tal|q tal|todo bien)/.test(normalized)) {
      return shortPreviousTopic != null
        ? `Todo bien 👍 Seguimos con ${shortPreviousTopic}. ¿Prefieres que avancemos con opciones o con precios?`
        : 'Todo bien 👍 Dime qué necesitas y lo vemos de una vez.';
    }

    if (/^(si|sí|ok|oki|dale|perfecto|de acuerdo|claro|yes)\b/.test(normalized)) {
      return shortPreviousTopic != null
        ? `Perfecto 👍 Sobre ${shortPreviousTopic}, ¿prefieres que te muestre precios o las opciones disponibles primero?`
        : 'Perfecto 👍 ¿Quieres que te muestre precios o prefieres ver opciones primero?';
    }

    if (normalized.length <= 12) {
      if (params.detectedIntent === 'pricing') {
        return 'Claro 👍 Te ayudo con precios. Dime cuál producto o servicio te interesa y te oriento.';
      }
      return shortPreviousTopic != null
        ? `Seguimos con ${shortPreviousTopic}. Te puedo mostrar opciones, precios o disponibilidad, como prefieras.`
        : `Claro ${namePrefix}te puedo mostrar opciones, precios o disponibilidad. ¿Por cuál quieres empezar?`;
    }

    if (params.detectedIntent === 'pricing') {
      return `Perfecto. Para ayudarte con precios sin hacerte perder tiempo, dime qué producto o servicio te interesa y te guío.`;
    }

    if (params.detectedIntent === 'support') {
      return `Entiendo. Vamos a resolverlo. Dime qué parte te está dando problema y te guío paso a paso.`;
    }

    return shortPreviousTopic != null
      ? `Entiendo. Seguimos con ${shortPreviousTopic}. Si quieres, te doy opciones, precios o una recomendación puntual.`
      : 'Entiendo. Te ayudo con eso. Si quieres, te doy opciones, precios o una recomendación puntual.';
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
}