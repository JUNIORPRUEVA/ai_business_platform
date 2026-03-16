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

  async createFromUser(companyId: string, conversationId: string, dto: CreateMessageDto): Promise<MessageEntity> {
    return this.create(companyId, conversationId, {
      sender: 'user',
      content: dto.content,
      type: dto.type ?? 'text',
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
      metadata: params.metadata ?? {},
    });

    return this.messagesRepository.save(entity);
  }
}
