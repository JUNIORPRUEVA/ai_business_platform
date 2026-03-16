import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EvolutionMessageWebhookDto } from '../dto/evolution-message-webhook.dto';
import {
  EvolutionWebhookProcessResponse,
  NormalizedEvolutionMessage,
} from '../types/evolution-webhook.types';

import { ChannelsService } from '../../channels/channels.service';
import { ContactsService } from '../../contacts/contacts.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { MessagesService } from '../../messages/messages.service';
import { MessageProcessingJob } from '../../workers/processors/message-processing.processor';

@Injectable()
export class EvolutionWebhookService {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    @InjectQueue('message-processing')
    private readonly messageProcessingQueue: Queue<MessageProcessingJob>,
  ) {}

  async processIncomingMessage(params: {
    channelId: string;
    webhookToken?: string;
    payload: EvolutionMessageWebhookDto;
  }): Promise<EvolutionWebhookProcessResponse> {
    const normalized = this.normalizePayload(params.payload);
    const channel = await this.channelsService.getByIdUnsafe(params.channelId);

    if (channel.type !== 'whatsapp') {
      throw new BadRequestException('Channel is not a WhatsApp channel.');
    }

    const configuredToken =
      typeof channel.config['webhookToken'] === 'string'
        ? (channel.config['webhookToken'] as string)
        : '';
    if (configuredToken && params.webhookToken !== configuredToken) {
      throw new ForbiddenException('Invalid webhook token.');
    }

    const companyId = channel.companyId;
    const contactPhone = normalized.senderId;
    const contact = await this.contactsService.findOrCreateByPhone(
      companyId,
      contactPhone,
      normalized.senderName ?? null,
    );

    const conversation = await this.conversationsService.findOrCreateOpen(
      companyId,
      channel.id,
      contact.id,
    );

    const message = await this.messagesService.create(companyId, conversation.id, {
      sender: 'client',
      content: normalized.message,
      type: 'text',
      metadata: normalized.metadata,
    });

    await this.messageProcessingQueue.add(
      'process-inbound-message',
      {
        companyId,
        channelId: channel.id,
        contactPhone,
        conversationId: conversation.id,
        messageId: message.id,
      },
      {
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    return {
      normalizedMessage: normalized,
      orchestration: {
        queued: true,
        conversationId: conversation.id,
        messageId: message.id,
      },
    };
  }

  private normalizePayload(
    payload: EvolutionMessageWebhookDto,
  ): NormalizedEvolutionMessage {
    const senderId = payload.data.key.remoteJid?.trim();
    const message = this.extractMessageText(payload);

    if (!senderId || !message) {
      throw new BadRequestException(
        'Evolution webhook payload did not contain a valid sender or message.',
      );
    }

    return {
      channel: 'whatsapp',
      senderId,
      senderName: payload.data.pushName,
      message,
      timestamp: payload.data.messageTimestamp,
      metadata: {
        event: payload.event,
        instance: payload.instance,
        rawMessage: payload.data.message,
      },
    };
  }

  private extractMessageText(payload: EvolutionMessageWebhookDto): string {
    const directText = payload.data.text?.trim();
    if (directText) {
      return directText;
    }

    const message = payload.data.message;
    if (!message) {
      return '';
    }

    const conversation = message['conversation'];
    if (typeof conversation === 'string' && conversation.trim()) {
      return conversation.trim();
    }

    const extendedText = message['extendedTextMessage'];
    if (
      typeof extendedText === 'object' &&
      extendedText !== null &&
      typeof (extendedText as { text?: unknown }).text === 'string'
    ) {
      return ((extendedText as { text: string }).text).trim();
    }

    const imageCaption = message['imageMessage'];
    if (
      typeof imageCaption === 'object' &&
      imageCaption !== null &&
      typeof (imageCaption as { caption?: unknown }).caption === 'string'
    ) {
      return ((imageCaption as { caption: string }).caption).trim();
    }

    return '';
  }
}