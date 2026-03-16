import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ContactEntity } from '../../contacts/entities/contact.entity';
import { ClientMemoryEntity } from '../entities/client-memory.entity';
import { ExtractedClientMemory } from '../types/ai-brain.types';

@Injectable()
export class AiBrainMemoryService {
  constructor(
    @InjectRepository(ClientMemoryEntity)
    private readonly clientMemoriesRepository: Repository<ClientMemoryEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactsRepository: Repository<ContactEntity>,
  ) {}

  async listByContact(companyId: string, contactId: string): Promise<ClientMemoryEntity[]> {
    return this.clientMemoriesRepository.find({
      where: { companyId, contactId },
      order: { updatedAt: 'DESC', createdAt: 'DESC' },
      take: 50,
    });
  }

  async upsertExtractedMemories(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    items: ExtractedClientMemory[];
  }): Promise<void> {
    for (const item of params.items) {
      const existing = await this.clientMemoriesRepository.findOne({
        where: {
          companyId: params.companyId,
          contactId: params.contactId,
          key: item.key,
        },
        order: { updatedAt: 'DESC', createdAt: 'DESC' },
      });

      if (existing) {
        existing.value = item.value;
        existing.category = item.category;
        existing.confidence = item.confidence;
        existing.conversationId = params.conversationId;
        existing.metadata = {
          ...existing.metadata,
          source: 'auto-extraction',
        };
        await this.clientMemoriesRepository.save(existing);
        continue;
      }

      const created = this.clientMemoriesRepository.create({
        companyId: params.companyId,
        contactId: params.contactId,
        conversationId: params.conversationId,
        key: item.key,
        value: item.value,
        category: item.category,
        confidence: item.confidence,
        metadata: {
          source: 'auto-extraction',
        },
      });
      await this.clientMemoriesRepository.save(created);
    }

    await this.syncContactRecord(params.companyId, params.contactId);
  }

  extractClientMemories(message: string): ExtractedClientMemory[] {
    const normalized = message.trim();
    if (!normalized) {
      return [];
    }

    const extracted: ExtractedClientMemory[] = [];
    const rules: Array<{ key: string; category: string; regex: RegExp }> = [
      {
        key: 'customer_name',
        category: 'profile',
        regex: /(?:me llamo|mi nombre es|soy)\s+([a-zA-ZÀ-ÿ'\- ]{2,60})/i,
      },
      {
        key: 'customer_email',
        category: 'contact',
        regex: /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
      },
      {
        key: 'customer_city',
        category: 'location',
        regex: /(?:vivo en|estoy en|soy de)\s+([a-zA-ZÀ-ÿ'\- ]{2,60})/i,
      },
      {
        key: 'product_interest',
        category: 'commercial',
        regex: /(?:busco|quiero|necesito|me interesa)\s+(.{3,80})/i,
      },
    ];

    for (const rule of rules) {
      const match = normalized.match(rule.regex);
      const value = match?.[1]?.trim();
      if (!value) {
        continue;
      }

      extracted.push({
        key: rule.key,
        value,
        category: rule.category,
        confidence: rule.key === 'product_interest' ? 0.58 : 0.82,
      });
    }

    return extracted;
  }

  private async syncContactRecord(companyId: string, contactId: string): Promise<void> {
    const contact = await this.contactsRepository.findOne({ where: { id: contactId, companyId } });
    if (!contact) {
      return;
    }

    const memories = await this.listByContact(companyId, contactId);
    const name = memories.find((item) => item.key === 'customer_name')?.value;
    const email = memories.find((item) => item.key === 'customer_email')?.value;

    if (name && !contact.name) {
      contact.name = name;
    }
    if (email && !contact.email) {
      contact.email = email;
    }

    await this.contactsRepository.save(contact);
  }
}