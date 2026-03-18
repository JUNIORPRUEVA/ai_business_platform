import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { AppendConversationMemoryInput } from './memory.types';
import { MemoryCacheService } from './memory-cache.service';
import { MemoryDeduplicationService } from './memory-deduplication.service';
import { ConversationMemoryEntity } from './entities/conversation-memory.entity';

@Injectable()
export class ConversationMemoryService {
  private readonly logger = new Logger(ConversationMemoryService.name);

  constructor(
    @InjectRepository(ConversationMemoryEntity)
    private readonly conversationMemoryRepository: Repository<ConversationMemoryEntity>,
    private readonly memoryCacheService: MemoryCacheService,
    private readonly memoryDeduplicationService: MemoryDeduplicationService,
  ) {}

  async append(input: AppendConversationMemoryInput): Promise<ConversationMemoryEntity | null> {
    const content = input.content.trim();
    if (!content) {
      return null;
    }

    const contentHash = this.memoryDeduplicationService.buildContentHash([
      input.companyId,
      input.contactId,
      input.conversationId,
      input.role,
      input.source,
      content,
      JSON.stringify(input.metadataJson ?? {}),
    ]);

    const duplicate = await this.findDuplicate({ ...input, contentHash, content });
    if (duplicate) {
      this.logger.debug(`Duplicate conversation memory ignored for conversation ${input.conversationId}.`);
      return duplicate;
    }

    const entity = this.conversationMemoryRepository.create({
      companyId: input.companyId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      role: input.role,
      content,
      contentType: input.contentType ?? 'text',
      metadataJson: input.metadataJson ?? {},
      source: input.source,
      messageId: input.messageId ?? null,
      eventId: input.eventId ?? null,
      contentHash,
      compactedAt: null,
    });

    const saved = await this.conversationMemoryRepository.save(entity);
    await this.memoryCacheService.delete(
      this.memoryCacheService.recentWindowKey(input.companyId, input.conversationId),
    );
    await this.memoryCacheService.delete(
      this.memoryCacheService.summaryKey(input.companyId, input.conversationId),
    );
    this.logger.debug(`Conversation memory stored for conversation ${input.conversationId}.`);
    return saved;
  }

  async ensureSystemPrompt(input: Omit<AppendConversationMemoryInput, 'role' | 'source'> & { source?: string }): Promise<void> {
    const existing = await this.conversationMemoryRepository.findOne({
      where: {
        companyId: input.companyId,
        conversationId: input.conversationId,
        role: 'system',
        compactedAt: IsNull(),
      },
      order: { createdAt: 'ASC' },
    });

    if (existing) {
      return;
    }

    await this.append({
      ...input,
      role: 'system',
      source: input.source ?? 'system_prompt',
    });
  }

  async listRecent(companyId: string, conversationId: string, limit: number): Promise<ConversationMemoryEntity[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const cacheKey = this.memoryCacheService.recentWindowKey(companyId, conversationId);
    const cached = await this.memoryCacheService.getJson<ConversationMemoryEntity[]>(cacheKey);
    if (cached) {
      return cached.slice(-safeLimit);
    }

    const recordsDesc = await this.conversationMemoryRepository.find({
      where: {
        companyId,
        conversationId,
        compactedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });

    const records = recordsDesc.reverse();
    await this.memoryCacheService.setJson(cacheKey, records, 600);
    return records;
  }

  async countActive(companyId: string, conversationId: string): Promise<number> {
    return this.conversationMemoryRepository.count({
      where: {
        companyId,
        conversationId,
        compactedAt: IsNull(),
      },
    });
  }

  async listSummaryCandidates(params: {
    companyId: string;
    conversationId: string;
    keepRecentCount: number;
    sinceCreatedAt?: Date | null;
  }): Promise<ConversationMemoryEntity[]> {
    const recentDesc = await this.conversationMemoryRepository.find({
      where: {
        companyId: params.companyId,
        conversationId: params.conversationId,
        compactedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(params.keepRecentCount, 1), 100),
    });

    const cutoff = recentDesc.length === 0 ? null : recentDesc[recentDesc.length - 1].createdAt;
    if (!cutoff) {
      return [];
    }

    const query = this.conversationMemoryRepository
      .createQueryBuilder('memory')
      .where('memory.company_id = :companyId', { companyId: params.companyId })
      .andWhere('memory.conversation_id = :conversationId', { conversationId: params.conversationId })
      .andWhere('memory.compacted_at IS NULL')
      .andWhere('memory.created_at < :cutoff', { cutoff: cutoff.toISOString() })
      .andWhere("memory.source <> 'manual_short_term'")
      .orderBy('memory.created_at', 'ASC')
      .limit(200);

    if (params.sinceCreatedAt) {
      query.andWhere('memory.created_at > :sinceCreatedAt', {
        sinceCreatedAt: params.sinceCreatedAt.toISOString(),
      });
    }

    return query.getMany();
  }

  async compactRecords(recordIds: string[]): Promise<void> {
    if (recordIds.length === 0) {
      return;
    }

    await this.conversationMemoryRepository
      .createQueryBuilder()
      .update(ConversationMemoryEntity)
      .set({ compactedAt: () => 'now()' })
      .whereInIds(recordIds)
      .execute();
  }

  async getManualShortTermNotes(companyId: string, conversationId: string): Promise<ConversationMemoryEntity[]> {
    return this.conversationMemoryRepository.find({
      where: {
        companyId,
        conversationId,
        source: 'manual_short_term',
      },
      order: { updatedAt: 'DESC' },
    });
  }

  async updateManualShortTermNote(companyId: string, conversationId: string, id: string, title?: string, content?: string): Promise<ConversationMemoryEntity> {
    const existing = await this.conversationMemoryRepository.findOne({
      where: { id, companyId, conversationId, source: 'manual_short_term' },
    });

    if (!existing) {
      throw new Error(`Manual short-term memory ${id} not found.`);
    }

    existing.content = content?.trim() || existing.content;
    existing.contentHash = this.memoryDeduplicationService.buildContentHash([
      companyId,
      conversationId,
      existing.role,
      existing.source,
      existing.content,
    ]);
    existing.metadataJson = {
      ...existing.metadataJson,
      title: title?.trim() || (existing.metadataJson['title'] as string | undefined) || 'Nota de memoria',
    };
    const saved = await this.conversationMemoryRepository.save(existing);
    await this.memoryCacheService.delete(this.memoryCacheService.recentWindowKey(companyId, conversationId));
    return saved;
  }

  async deleteManualShortTermNote(companyId: string, conversationId: string, id: string): Promise<void> {
    await this.conversationMemoryRepository.delete({ id, companyId, conversationId, source: 'manual_short_term' });
    await this.memoryCacheService.delete(this.memoryCacheService.recentWindowKey(companyId, conversationId));
  }

  private async findDuplicate(params: AppendConversationMemoryInput & { contentHash: string; content: string }): Promise<ConversationMemoryEntity | null> {
    if (params.messageId) {
      const byMessageId = await this.conversationMemoryRepository.findOne({
        where: {
          companyId: params.companyId,
          conversationId: params.conversationId,
          source: params.source,
          messageId: params.messageId,
        },
      });
      if (byMessageId) {
        return byMessageId;
      }
    }

    if (params.eventId) {
      const byEventId = await this.conversationMemoryRepository.findOne({
        where: {
          companyId: params.companyId,
          conversationId: params.conversationId,
          source: params.source,
          eventId: params.eventId,
        },
      });
      if (byEventId) {
        return byEventId;
      }
    }

    if (params.dedupeAgainstLast) {
      const last = await this.conversationMemoryRepository.findOne({
        where: {
          companyId: params.companyId,
          conversationId: params.conversationId,
          compactedAt: IsNull(),
        },
        order: { createdAt: 'DESC' },
      });

      if (last && last.role === params.role && last.source === params.source && last.contentHash === params.contentHash) {
        return last;
      }
    }

    return null;
  }
}