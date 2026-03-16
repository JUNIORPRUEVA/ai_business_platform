import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ChannelEntity } from '../channels/entities/channel.entity';
import { ContactEntity } from '../contacts/entities/contact.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationEntity } from './entities/conversation.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(ConversationEntity)
    private readonly conversationsRepository: Repository<ConversationEntity>,
    @InjectRepository(ChannelEntity)
    private readonly channelsRepository: Repository<ChannelEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactsRepository: Repository<ContactEntity>,
  ) {}

  list(companyId: string) {
    return this.conversationsRepository.find({
      where: { companyId },
      order: { createdAt: 'DESC' },
    });
  }

  async get(companyId: string, id: string) {
    const conversation = await this.conversationsRepository.findOne({
      where: { id, companyId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found.');
    return conversation;
  }

  async create(companyId: string, dto: CreateConversationDto) {
    const channel = await this.channelsRepository.findOne({
      where: { id: dto.channelId, companyId },
    });
    if (!channel) throw new NotFoundException('Channel not found.');

    const contact = await this.contactsRepository.findOne({
      where: { id: dto.contactId, companyId },
    });
    if (!contact) throw new NotFoundException('Contact not found.');

    const entity = this.conversationsRepository.create({
      companyId,
      channelId: channel.id,
      contactId: contact.id,
      status: dto.status ?? 'open',
    });

    return this.conversationsRepository.save(entity);
  }

  async update(companyId: string, id: string, dto: UpdateConversationDto) {
    const conversation = await this.get(companyId, id);
    const merged = this.conversationsRepository.merge(conversation, dto);
    return this.conversationsRepository.save(merged);
  }

  async remove(companyId: string, id: string) {
    const result = await this.conversationsRepository.delete({ id, companyId });
    if (result.affected === 0) throw new NotFoundException('Conversation not found.');
    return { deleted: true } as const;
  }

  async findOrCreateOpen(companyId: string, channelId: string, contactId: string) {
    const existing = await this.conversationsRepository.findOne({
      where: { companyId, channelId, contactId, status: 'open' },
      order: { createdAt: 'DESC' },
    });
    if (existing) return existing;

    const entity = this.conversationsRepository.create({
      companyId,
      channelId,
      contactId,
      status: 'open',
    });

    return this.conversationsRepository.save(entity);
  }
}
