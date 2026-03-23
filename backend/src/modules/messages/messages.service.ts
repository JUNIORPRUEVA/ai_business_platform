import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConversationEntity } from '../conversations/entities/conversation.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageEntity, MessageSender, MessageType } from './entities/message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(MessageEntity)
    private readonly messagesRepository: Repository<MessageEntity>,
    @InjectRepository(ConversationEntity)
    private readonly conversationsRepository: Repository<ConversationEntity>,
  ) {}

  async list(companyId: string, conversationId: string, limit = 50): Promise<MessageEntity[]> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.companyId !== companyId) throw new ForbiddenException();

    return this.messagesRepository.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      take: Math.min(Math.max(limit, 1), 200),
    });
  }

  async listRecent(companyId: string, conversationId: string, limit = 50): Promise<MessageEntity[]> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.companyId !== companyId) throw new ForbiddenException();

    const recentMessages = await this.messagesRepository.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    return recentMessages.reverse();
  }

  async getById(companyId: string, conversationId: string, messageId: string): Promise<MessageEntity | null> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.companyId !== companyId) throw new ForbiddenException();

    return this.messagesRepository.findOne({
      where: { id: messageId, conversationId },
    });
  }

  async createFromUser(companyId: string, conversationId: string, dto: CreateMessageDto): Promise<MessageEntity> {
    return this.create(companyId, conversationId, {
      sender: 'user',
      content: dto.content,
      type: dto.type ?? 'text',
      mediaUrl: dto.mediaUrl ?? null,
      mimeType: dto.mimeType ?? null,
      fileName: dto.fileName ?? null,
      duration: dto.duration ?? null,
      metadata: {},
    });
  }

  async create(
    companyId: string,
    conversationId: string,
    params: {
      sender: MessageSender;
      content: string;
      type: MessageType;
      mediaUrl?: string | null;
      mimeType?: string | null;
      fileName?: string | null;
      duration?: number | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<MessageEntity> {
    const conversation = await this.conversationsRepository.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.companyId !== companyId) throw new ForbiddenException();

    const entity = this.messagesRepository.create({
      conversationId,
      sender: params.sender,
      content: params.content,
      type: params.type,
      mediaUrl: params.mediaUrl ?? null,
      mimeType: params.mimeType ?? null,
      fileName: params.fileName ?? null,
      duration: params.duration ?? null,
      metadata: params.metadata ?? {},
    });

    return this.messagesRepository.save(entity);
  }

  async findByMetadataValue(
    companyId: string,
    conversationId: string,
    metadataKey: string,
    metadataValue: string,
  ): Promise<MessageEntity | null> {
    const conversation = await this.conversationsRepository.findOne({ where: { id: conversationId } });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    if (conversation.companyId !== companyId) throw new ForbiddenException();

    return this.messagesRepository
      .createQueryBuilder('message')
      .where('message.conversation_id = :conversationId', { conversationId })
      .andWhere(`message.metadata ->> :metadataKey = :metadataValue`, {
        metadataKey,
        metadataValue,
      })
      .orderBy('message.created_at', 'DESC')
      .getOne();
  }

  async updateMessageContent(
    companyId: string,
    conversationId: string,
    messageId: string,
    params: {
      content: string;
      type?: MessageType;
      mediaUrl?: string | null;
      mimeType?: string | null;
      fileName?: string | null;
      duration?: number | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<MessageEntity> {
    const existing = await this.getById(companyId, conversationId, messageId);
    if (!existing) {
      throw new NotFoundException('Message not found.');
    }

    existing.content = params.content;
    if (params.type !== undefined) existing.type = params.type;
    if (params.mediaUrl !== undefined) existing.mediaUrl = params.mediaUrl;
    if (params.mimeType !== undefined) existing.mimeType = params.mimeType;
    if (params.fileName !== undefined) existing.fileName = params.fileName;
    if (params.duration !== undefined) existing.duration = params.duration;
    if (params.metadata !== undefined) existing.metadata = params.metadata;

    return this.messagesRepository.save(existing);
  }
}
