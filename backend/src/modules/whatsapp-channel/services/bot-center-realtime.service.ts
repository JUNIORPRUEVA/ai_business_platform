import { Injectable, MessageEvent } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Subject, filter, interval, map, merge, of } from 'rxjs';
import { Repository } from 'typeorm';

import { StorageService } from '../../storage/storage.service';
import {
  BotCenterRealtimeEventResponse,
  BotConversationSummary,
  BotMessageResponse,
} from '../../bot-center/types/bot-center.types';
import { WhatsappChatEntity } from '../entities/whatsapp-chat.entity';
import { WhatsappMessageEntity } from '../entities/whatsapp-message.entity';

type RealtimeEventName = 'message.upsert' | 'message.status';
type CompanyRealtimeEvent = {
  companyId: string;
  event: RealtimeEventName;
  payload: BotCenterRealtimeEventResponse;
};

@Injectable()
export class BotCenterRealtimeService {
  private readonly events = new Subject<CompanyRealtimeEvent>();

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(WhatsappChatEntity)
    private readonly chatsRepository: Repository<WhatsappChatEntity>,
    private readonly storageService: StorageService,
  ) {}

  streamCompanyEvents(companyId: string): Observable<MessageEvent> {
    const ready$ = of<MessageEvent>({
      type: 'bot-center.ready',
      data: { connectedAt: new Date().toISOString() },
    });

    const heartbeat$: Observable<MessageEvent> = interval(15000).pipe(
      map((): MessageEvent => ({
        type: 'bot-center.ping',
        data: { timestamp: new Date().toISOString() },
      })),
    );

    const updates$: Observable<MessageEvent> = this.events.pipe(
      filter((event: CompanyRealtimeEvent) => event.companyId === companyId),
      map(({ event, payload }: CompanyRealtimeEvent): MessageEvent => ({
        type: event,
        data: payload,
      })),
    );

    return merge(ready$, heartbeat$, updates$);
  }

  async publishMessageUpsert(message: WhatsappMessageEntity): Promise<void> {
    await this.publishMessageEvent('message.upsert', message);
  }

  async publishMessageStatus(message: WhatsappMessageEntity): Promise<void> {
    await this.publishMessageEvent('message.status', message);
  }

  private async publishMessageEvent(
    event: RealtimeEventName,
    message: WhatsappMessageEntity,
  ): Promise<void> {
    const chat = await this.chatsRepository.findOne({
      where: { id: message.chatId, companyId: message.companyId },
    });
    if (!chat) {
      return;
    }

    this.events.next({
      companyId: message.companyId,
      event,
      payload: {
        event,
        conversation: this.toConversationSummary(chat, message),
        message: await this.toBotMessage(message),
      },
    });
  }

  private toConversationSummary(
    chat: WhatsappChatEntity,
    latestMessage: WhatsappMessageEntity,
  ): BotConversationSummary {
    const timestamp = chat.lastMessageAt ?? latestMessage.createdAt ?? chat.updatedAt ?? chat.createdAt;

    return {
      id: chat.id,
      contactName: this.resolveContactName(chat),
      phone: this.toPhoneDisplay(chat.remoteJid),
      lastMessagePreview: this.describeMessage(latestMessage),
      unreadCount: chat.unreadCount,
      stage: this.resolveConversationStage(chat, latestMessage),
      timestamp: timestamp.toISOString(),
    };
  }

  private async toBotMessage(message: WhatsappMessageEntity): Promise<BotMessageResponse> {
    const mediaUrl = await this.resolveMessageMediaUrl(message);
    const thumbnailUrl =
      message.messageType === 'image'
        ? mediaUrl
        : await this.resolveStoredUrlCandidate(message.companyId, message.thumbnailUrl);

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

  private resolveConversationStage(
    chat: WhatsappChatEntity,
    latestMessage: WhatsappMessageEntity,
  ): BotConversationSummary['stage'] {
    if (latestMessage.status === 'failed') {
      return 'escalated';
    }
    if (chat.unreadCount > 0) {
      return 'follow_up';
    }
    if (latestMessage.fromMe) {
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
        // fall through
      }
    }

    return this.resolveStoredUrlCandidate(companyId, fallbackUrl);
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
}