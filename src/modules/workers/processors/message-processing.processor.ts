import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { AiService } from '../../ai/ai.service';
import { BotsService } from '../../bots/bots.service';
import { ChannelsService } from '../../channels/channels.service';
import { EvolutionApiService } from '../../channels/services/evolution-api.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessagesService } from '../../messages/messages.service';
import { PromptsService } from '../../prompts/prompts.service';

export interface MessageProcessingJob {
  companyId: string;
  channelId: string;
  contactPhone: string;
  conversationId: string;
  messageId: string;
}

@Processor('message-processing')
export class MessageProcessingProcessor extends WorkerHost {
  constructor(
    private readonly aiService: AiService,
    private readonly botsService: BotsService,
    private readonly channelsService: ChannelsService,
    private readonly promptsService: PromptsService,
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly evolutionApiService: EvolutionApiService,
  ) {
    super();
  }

  async process(job: Job<MessageProcessingJob>): Promise<{ ok: true }> {
    const { companyId, channelId, conversationId, contactPhone } = job.data;

    // Ensure conversation belongs to company
    await this.conversationsService.get(companyId, conversationId);

    const channel = await this.channelsService.get(companyId, channelId);
    const bot = await this.botsService.getDefaultActiveBot(companyId);
    const systemPrompt =
      (await this.promptsService.getActiveSystemPrompt(companyId)) ??
      'Eres un bot conversacional empresarial. Responde de forma clara y profesional.';

    const recent = await this.messagesService.list(companyId, conversationId, 20);
    const history = recent
      .filter((m) => m.sender === 'user' || m.sender === 'bot' || m.sender === 'client')
      .map((m) => ({
        role: m.sender === 'bot' ? ('assistant' as const) : ('user' as const),
        content: m.content,
      }));

    const lastUserMessage = recent.length > 0 ? recent[recent.length - 1]?.content : '';

    const draft = await this.aiService.draftReply({
      model: bot.model,
      temperature: bot.temperature,
      systemPrompt,
      userMessage: lastUserMessage ?? '',
      history,
    });

    const botMessage = await this.messagesService.create(companyId, conversationId, {
      sender: 'bot',
      content: draft.content,
      type: 'text',
    });

    if (channel.type === 'whatsapp') {
      await this.evolutionApiService.sendTextMessage({
        channel,
        to: contactPhone,
        text: botMessage.content,
      });
    }

    return { ok: true };
  }
}
