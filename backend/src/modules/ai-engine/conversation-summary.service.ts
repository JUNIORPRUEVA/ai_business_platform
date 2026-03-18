import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ClientMemoryService } from './client-memory.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { MemoryCacheService } from './memory-cache.service';
import { ConversationSummaryEntity } from './entities/conversation-summary.entity';

@Injectable()
export class ConversationSummaryService {
  private readonly logger = new Logger(ConversationSummaryService.name);

  constructor(
    @InjectRepository(ConversationSummaryEntity)
    private readonly conversationSummaryRepository: Repository<ConversationSummaryEntity>,
    private readonly conversationMemoryService: ConversationMemoryService,
    private readonly clientMemoryService: ClientMemoryService,
    private readonly memoryCacheService: MemoryCacheService,
  ) {}

  async get(companyId: string, conversationId: string): Promise<ConversationSummaryEntity | null> {
    const cacheKey = this.memoryCacheService.summaryKey(companyId, conversationId);
    const cached = await this.memoryCacheService.getJson<ConversationSummaryEntity>(cacheKey);
    if (cached) {
      return cached;
    }

    const summary = await this.conversationSummaryRepository.findOne({
      where: { companyId, conversationId },
    });

    if (summary) {
      await this.memoryCacheService.setJson(cacheKey, summary, 900);
    }

    return summary;
  }

  async refreshIfNeeded(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    recentWindowSize: number;
    summaryRefreshThreshold: number;
  }): Promise<ConversationSummaryEntity | null> {
    const existing = await this.get(params.companyId, params.conversationId);
    const sinceCreatedAt = existing ? existing.updatedAt : null;
    const candidates = await this.conversationMemoryService.listSummaryCandidates({
      companyId: params.companyId,
      conversationId: params.conversationId,
      keepRecentCount: params.recentWindowSize,
      sinceCreatedAt,
    });

    if (candidates.length < params.summaryRefreshThreshold) {
      return existing;
    }

    const facts = await this.clientMemoryService.listByContact(params.companyId, params.contactId);
    const factPayload = facts.slice(0, 8).map((item) => ({
      key: item.key,
      value: item.value,
      category: item.category,
    }));

    const summaryText = this.buildSummaryText(candidates, factPayload);
    const lastCandidate = candidates[candidates.length - 1] ?? null;
    const summary = existing
      ? this.conversationSummaryRepository.merge(existing, {
          summaryText,
          keyFactsJson: factPayload,
          lastMessageId: lastCandidate?.messageId ?? existing.lastMessageId,
          summaryVersion: existing.summaryVersion + 1,
          metadataJson: {
            ...(existing.metadataJson ?? {}),
            summarizedRecords: candidates.length,
          },
        })
      : this.conversationSummaryRepository.create({
          companyId: params.companyId,
          contactId: params.contactId,
          conversationId: params.conversationId,
          summaryText,
          keyFactsJson: factPayload,
          lastMessageId: lastCandidate?.messageId ?? null,
          summaryVersion: 1,
          metadataJson: {
            summarizedRecords: candidates.length,
          },
        });

    const saved = await this.conversationSummaryRepository.save(summary);
    await this.conversationMemoryService.compactRecords(candidates.map((item) => item.id));
    await this.memoryCacheService.setJson(
      this.memoryCacheService.summaryKey(params.companyId, params.conversationId),
      saved,
      900,
    );
    this.logger.debug(`Conversation summary refreshed for conversation ${params.conversationId}.`);
    return saved;
  }

  private buildSummaryText(
    records: Array<{ role: string; content: string; source: string }>,
    facts: Array<{ key: string; value: string; category: string }>,
  ): string {
    const relevantLines = records
      .filter((record) => record.role !== 'system')
      .slice(-24)
      .map((record) => `- ${record.role}/${record.source}: ${record.content.slice(0, 200)}`);

    const factLines = facts.map((fact) => `- [${fact.category}] ${fact.key}: ${fact.value}`);

    return [
      'Resumen persistente de la conversación:',
      relevantLines.length > 0 ? relevantLines.join('\n') : '- Sin actividad relevante previa.',
      '',
      'Key facts del cliente:',
      factLines.length > 0 ? factLines.join('\n') : '- Sin facts persistentes.',
    ].join('\n');
  }
}