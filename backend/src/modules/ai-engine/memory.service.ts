import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';

import { ContactMemoryEntity } from './entities/contact-memory.entity';
import { ConversationMemoryEntity, ConversationMemoryRole } from './entities/conversation-memory.entity';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  // Intentionally created lazily (only when needed) to avoid extra connections in environments without Redis.
  private redis: Redis | null = null;

  constructor(
    @InjectRepository(ConversationMemoryEntity)
    private readonly conversationMemoryRepository: Repository<ConversationMemoryEntity>,
    @InjectRepository(ContactMemoryEntity)
    private readonly contactMemoryRepository: Repository<ContactMemoryEntity>,
  ) {}

  configureRedis(client: Redis | null): void {
    this.redis = client;
  }

  async appendConversationMemory(params: {
    conversationId: string;
    role: ConversationMemoryRole;
    content: string;
    dedupeAgainstLast?: boolean;
  }): Promise<ConversationMemoryEntity | null> {
    const content = params.content?.trim();
    if (!content) return null;

    if (params.dedupeAgainstLast) {
      const last = await this.conversationMemoryRepository.findOne({
        where: { conversationId: params.conversationId },
        order: { createdAt: 'DESC' },
      });
      if (last && last.role === params.role && last.content === content) {
        return null;
      }
    }

    const entity = this.conversationMemoryRepository.create({
      conversationId: params.conversationId,
      role: params.role,
      content,
    });

    const saved = await this.conversationMemoryRepository.save(entity);
    await this.bumpConversationCache(params.conversationId).catch((error) => {
      this.logger.debug(`Conversation cache update failed: ${(error as Error).message}`);
    });
    return saved;
  }

  async ensureConversationSystemPrompt(conversationId: string, content: string): Promise<void> {
    const normalized = content?.trim();
    if (!normalized) return;

    const existing = await this.conversationMemoryRepository.findOne({
      where: { conversationId, role: 'system' },
      order: { createdAt: 'ASC' },
    });

    if (existing) return;

    await this.appendConversationMemory({
      conversationId,
      role: 'system',
      content: normalized,
      dedupeAgainstLast: false,
    });
  }

  async listConversationMemory(conversationId: string, limit = 10): Promise<ConversationMemoryEntity[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);

    const cached = await this.getConversationCache(conversationId);
    if (cached) {
      return cached.slice(-safeLimit);
    }

    // Load most recent N, then flip back to chronological order.
    const recordsDesc = await this.conversationMemoryRepository.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });

    const records = recordsDesc.reverse();

    await this.setConversationCache(conversationId, records).catch(() => undefined);
    return records;
  }

  async getContactMemoryMap(contactId: string): Promise<Record<string, string>> {
    const cached = await this.getContactCache(contactId);
    if (cached) return cached;

    const records = await this.contactMemoryRepository.find({
      where: { contactId },
      order: { createdAt: 'DESC' },
      take: 200,
    });

    const map: Record<string, string> = {};
    for (const record of records) {
      if (map[record.key] === undefined) {
        map[record.key] = record.value;
      }
    }

    await this.setContactCache(contactId, map).catch(() => undefined);
    return map;
  }

  async setContactMemory(params: { contactId: string; key: string; value: string }): Promise<ContactMemoryEntity> {
    const key = params.key.trim();
    const value = params.value.trim();

    const entity = this.contactMemoryRepository.create({
      contactId: params.contactId,
      key,
      value,
    });

    const saved = await this.contactMemoryRepository.save(entity);
    await this.dropContactCache(params.contactId).catch(() => undefined);
    return saved;
  }

  // Redis helpers (TTL is short-lived, since DB is source of truth)

  private conversationCacheKey(conversationId: string): string {
    return `ai:conversation_memory:${conversationId}`;
  }

  private contactCacheKey(contactId: string): string {
    return `ai:contact_memory:${contactId}`;
  }

  private async getConversationCache(conversationId: string): Promise<ConversationMemoryEntity[] | null> {
    if (!this.redis) return null;
    const value = await this.redis.get(this.conversationCacheKey(conversationId));
    if (!value) return null;
    try {
      return JSON.parse(value) as ConversationMemoryEntity[];
    } catch {
      return null;
    }
  }

  private async setConversationCache(conversationId: string, records: ConversationMemoryEntity[]): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(this.conversationCacheKey(conversationId), JSON.stringify(records), 'EX', 600);
  }

  private async bumpConversationCache(conversationId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(this.conversationCacheKey(conversationId));
  }

  private async getContactCache(contactId: string): Promise<Record<string, string> | null> {
    if (!this.redis) return null;
    const value = await this.redis.get(this.contactCacheKey(contactId));
    if (!value) return null;
    try {
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return null;
    }
  }

  private async setContactCache(contactId: string, map: Record<string, string>): Promise<void> {
    if (!this.redis) return;
    await this.redis.set(this.contactCacheKey(contactId), JSON.stringify(map), 'EX', 600);
  }

  private async dropContactCache(contactId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(this.contactCacheKey(contactId));
  }
}
