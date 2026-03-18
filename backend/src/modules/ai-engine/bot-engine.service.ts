import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BotsService } from '../bots/bots.service';
import { ChannelsService } from '../channels/channels.service';
import { CompaniesService } from '../companies/companies.service';
import { ContactsService } from '../contacts/contacts.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { PromptsService } from '../prompts/prompts.service';
import { EvolutionService } from '../evolution/evolution.service';
import { ToolRunnerService, ToolRequestEnvelope } from './tool-runner.service';
import { MemoryService } from './memory.service';
import { PromptBuilderService } from './prompt-builder.service';

@Injectable()
export class BotEngineService {
  private readonly logger = new Logger(BotEngineService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly companiesService: CompaniesService,
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly botsService: BotsService,
    private readonly promptsService: PromptsService,
    private readonly evolutionService: EvolutionService,
    private readonly memoryService: MemoryService,
    private readonly promptBuilderService: PromptBuilderService,
    private readonly toolRunnerService: ToolRunnerService,
  ) {}

  async processInboundMessage(params: {
    companyId: string;
    channelId: string;
    conversationId: string;
    contactPhone: string;
    messageId: string;
  }): Promise<{ ok: true }> {
    // 1) Identify company/channel/contact/conversation already guaranteed by webhook+job
    const company = await this.companiesService.getMyCompany(params.companyId);
    const channel = await this.channelsService.get(params.companyId, params.channelId);
    const conversation = await this.conversationsService.get(params.companyId, params.conversationId);
    const contact = await this.contactsService.get(params.companyId, conversation.contactId);

    // 2) Load bot configuration
    const bot = await this.botsService.getDefaultActiveBot(params.companyId);

    // 4) Load conversation history (last 10) + contact memory
    // Backfill conversation_memory from messages if empty.
    await this.backfillConversationMemoryIfNeeded(params.companyId, params.conversationId);

    const conversationHistory = await this.memoryService.listConversationMemory(
      params.companyId,
      params.conversationId,
      10,
    );
    const contactMemory = await this.memoryService.getContactMemoryMap(params.companyId, contact.id);

    // 5) Determine base system prompt (bot.systemPrompt > active system prompt > default)
    const baseSystemPrompt =
      (bot.systemPrompt?.trim() && bot.systemPrompt) ||
      (await this.promptsService.getActiveSystemPrompt(params.companyId)) ||
      'Eres un asistente de ventas amable. Responde de forma profesional.';

    await this.memoryService.ensureConversationSystemPrompt({
      companyId: params.companyId,
      contactId: contact.id,
      conversationId: params.conversationId,
      content: baseSystemPrompt,
    });

    // 6) Get last user message (from messages table)
    const recentMessages = await this.messagesService.list(params.companyId, params.conversationId, 20);
    const lastMessage = recentMessages.length > 0 ? recentMessages[recentMessages.length - 1] : null;
    const userMessage = lastMessage?.content?.trim() || '';

    // 7) Persist inbound message into conversation_memory (role=user)
    await this.memoryService.appendConversationMemory({
      companyId: params.companyId,
      contactId: contact.id,
      conversationId: params.conversationId,
      role: 'user',
      content: userMessage,
      contentType: 'text',
      source: 'inbound_message',
      messageId: params.messageId,
      dedupeAgainstLast: true,
    });

    // 8) Build prompt + call OpenAI
    const systemPrompt = this.promptBuilderService.buildSystemPrompt({
      company,
      bot,
      baseSystemPrompt,
      contactMemory,
    });

    const messages = this.promptBuilderService.buildMessages({
      systemPrompt,
      history: conversationHistory,
      userMessage,
    });

    const firstDraft = await this.callOpenAi({
      model: bot.model,
      temperature: bot.temperature,
      messages,
    });

    // 9) Tool execution (if model asked for it)
    const maybeTool = this.tryParseToolRequest(firstDraft.content);

    let finalContent = firstDraft.content;
    if (maybeTool) {
      const toolResult = await this.toolRunnerService.run({
        companyId: params.companyId,
        botId: bot.id,
        contactId: contact.id,
        request: maybeTool,
      });

      await this.memoryService.appendConversationMemory({
        companyId: params.companyId,
        contactId: contact.id,
        conversationId: params.conversationId,
        role: 'tool',
        content: `Tool executed: ${toolResult.tool}. Result: ${JSON.stringify(toolResult.result)}`,
        contentType: 'json',
        source: 'tool_execution',
        dedupeAgainstLast: false,
      });

      const followupMessages = this.promptBuilderService.buildMessages({
        systemPrompt: `${systemPrompt}\n\nTool result:\n${JSON.stringify(toolResult.result)}`,
        history: await this.memoryService.listConversationMemory(params.companyId, params.conversationId, 10),
        userMessage,
      });

      const secondDraft = await this.callOpenAi({
        model: bot.model,
        temperature: bot.temperature,
        messages: followupMessages,
      });

      finalContent = secondDraft.content;
    }

    // 10) Save assistant response (messages table + conversation_memory)
    const botMessage = await this.messagesService.create(params.companyId, params.conversationId, {
      sender: 'bot',
      content: finalContent,
      type: 'text',
    });

    await this.memoryService.appendConversationMemory({
      companyId: params.companyId,
      contactId: contact.id,
      conversationId: params.conversationId,
      role: 'assistant',
      content: botMessage.content,
      contentType: 'text',
      source: 'assistant_response',
      messageId: botMessage.id,
      dedupeAgainstLast: true,
    });

    // 11) Send response via Evolution API
    if (channel.type === 'whatsapp') {
      if (!channel.instanceName) {
        this.logger.warn(`WhatsApp channel ${channel.id} has no instanceName; skipping outbound send.`);
      } else {
        await this.evolutionService.sendMessage({
          instanceName: channel.instanceName,
          phone: params.contactPhone,
          message: botMessage.content,
        });
      }
    }

    return { ok: true };
  }

  private async backfillConversationMemoryIfNeeded(companyId: string, conversationId: string): Promise<void> {
    const conversation = await this.conversationsService.get(companyId, conversationId);
    const existing = await this.memoryService.listConversationMemory(companyId, conversationId, 1);
    if (existing.length > 0) return;

    const messages = await this.messagesService.list(companyId, conversationId, 20);
    for (const message of messages) {
      const role = message.sender === 'bot' ? 'assistant' : 'user';
      await this.memoryService.appendConversationMemory({
        companyId,
        contactId: conversation.contactId,
        conversationId,
        role,
        content: message.content,
        contentType: 'text',
        source: message.sender === 'bot' ? 'assistant_response' : 'inbound_message',
        messageId: message.id,
        dedupeAgainstLast: false,
      });
    }
  }

  private async callOpenAi(params: {
    model: string;
    temperature: number;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  }): Promise<{ content: string; provider: 'openai' | 'mock' }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    const apiUrl = this.configService.get<string>('OPENAI_API_URL') ?? 'https://api.openai.com/v1/chat/completions';

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return {
        provider: 'mock',
        content: 'Gracias por tu mensaje. Un asesor te responderá en breve.',
      };
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: params.model,
          temperature: params.temperature,
          messages: params.messages,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`OpenAI request failed: ${response.status}`);
        return {
          provider: 'mock',
          content: 'Recibido. En este momento estoy teniendo dificultades para responder automáticamente.',
        };
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim();
      return {
        provider: 'openai',
        content: content && content.length > 0 ? content : 'Ok, entendido.',
      };
    } catch (error) {
      this.logger.warn(`OpenAI call exception: ${(error as Error).message}`);
      return {
        provider: 'mock',
        content: 'Recibido. En este momento estoy teniendo dificultades para responder automáticamente.',
      };
    }
  }

  private tryParseToolRequest(content: string): ToolRequestEnvelope | null {
    let trimmed = content.trim();

    // Handle common fenced JSON output.
    if (trimmed.startsWith('```')) {
      trimmed = trimmed
        .replace(/^```(?:json)?/i, '')
        .replace(/```$/, '')
        .trim();
    }

    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (typeof parsed !== 'object' || parsed === null) return null;

      const envelope = parsed as ToolRequestEnvelope;
      if (typeof envelope.tool !== 'string' || !envelope.tool.trim()) return null;
      if (envelope.data !== undefined && (typeof envelope.data !== 'object' || envelope.data === null)) return null;

      return envelope;
    } catch {
      return null;
    }
  }
}
