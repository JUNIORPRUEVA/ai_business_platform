import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ClientMemoryService } from './client-memory.service';
import { ContactMemoryService } from './contact-memory.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { ConversationSummaryService } from './conversation-summary.service';
import { MemoryContextAssemblerService } from './memory-context-assembler.service';
import { AppendConversationMemoryInput, MemoryManualItem } from './memory.types';
import { ContactMemoryEntity } from './entities/contact-memory.entity';
import { ConversationMemoryEntity } from './entities/conversation-memory.entity';
import { ConversationSummaryEntity } from './entities/conversation-summary.entity';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly conversationMemoryService: ConversationMemoryService,
    private readonly clientMemoryService: ClientMemoryService,
    private readonly contactMemoryService: ContactMemoryService,
    private readonly conversationSummaryService: ConversationSummaryService,
    private readonly memoryContextAssemblerService: MemoryContextAssemblerService,
  ) {}

  configureRedis(): void {
    // Redis is managed lazily by MemoryCacheService. Kept for compatibility.
  }

  async appendConversationMemory(params: AppendConversationMemoryInput): Promise<ConversationMemoryEntity | null> {
    return this.conversationMemoryService.append(params);
  }

  async ensureConversationSystemPrompt(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    content: string;
  }): Promise<void> {
    await this.conversationMemoryService.ensureSystemPrompt({
      ...params,
      contentType: 'text',
      metadataJson: {},
      source: 'system_prompt',
      messageId: null,
      eventId: null,
    });
  }

  async listConversationMemory(companyId: string, conversationId: string, limit = 10): Promise<ConversationMemoryEntity[]> {
    return this.conversationMemoryService.listRecent(companyId, conversationId, limit);
  }

  async getContactMemoryMap(companyId: string, contactId: string): Promise<Record<string, string>> {
    return this.contactMemoryService.getMap(companyId, contactId);
  }

  async listOperationalMemory(companyId: string, contactId: string): Promise<ContactMemoryEntity[]> {
    return this.contactMemoryService.list(companyId, contactId);
  }

  async setContactMemory(params: {
    companyId: string;
    contactId: string;
    conversationId?: string | null;
    key: string;
    value: string;
    stateType?: string;
    metadataJson?: Record<string, unknown>;
  }): Promise<ContactMemoryEntity> {
    return this.contactMemoryService.upsert(params);
  }

  async listClientMemories(companyId: string, contactId: string) {
    return this.clientMemoryService.listByContact(companyId, contactId);
  }

  async upsertClientMemories(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    items: Array<{ key: string; value: string; category: string; confidence: number; metadata?: Record<string, unknown> }>;
  }): Promise<void> {
    await this.clientMemoryService.upsertFacts(params);
  }

  extractClientMemories(message: string) {
    return this.clientMemoryService.extractFacts(message);
  }

  async refreshConversationSummary(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    recentWindowSize: number;
    summaryRefreshThreshold: number;
  }): Promise<ConversationSummaryEntity | null> {
    return this.conversationSummaryService.refreshIfNeeded(params);
  }

  async getConversationSummary(companyId: string, conversationId: string): Promise<ConversationSummaryEntity | null> {
    return this.conversationSummaryService.get(companyId, conversationId);
  }

  async assembleContext(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    recentWindowSize: number;
    incomingMessage?: string;
  }) {
    const [summary, keyFacts, operationalState, recentWindow] = await Promise.all([
      this.getConversationSummary(params.companyId, params.conversationId),
      this.listClientMemories(params.companyId, params.contactId),
      this.listOperationalMemory(params.companyId, params.contactId),
      this.listConversationMemory(params.companyId, params.conversationId, params.recentWindowSize),
    ]);

    const contextText = this.memoryContextAssemblerService.assemble({
      summaryText: summary?.summaryText,
      keyFacts: keyFacts.map((item) => ({ key: item.key, value: item.value, category: item.category })),
      operationalState: operationalState.map((item) => ({
        key: item.key,
        value: item.value,
        metadataJson: item.metadataJson,
      })),
      recentWindow: recentWindow.map((item) => ({ role: item.role, content: item.content, source: item.source })),
      incomingMessage: params.incomingMessage,
    });

    return {
      summary,
      keyFacts,
      operationalState,
      recentWindow,
      contextText,
    };
  }

  async createManualMemory(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    type: 'shortTerm' | 'longTerm' | 'operational';
    title: string;
    content: string;
  }): Promise<MemoryManualItem> {
    switch (params.type) {
      case 'shortTerm': {
        const created = await this.conversationMemoryService.append({
          companyId: params.companyId,
          contactId: params.contactId,
          conversationId: params.conversationId,
          role: 'system',
          content: params.content,
          contentType: 'text',
          metadataJson: { title: params.title, isEditable: true },
          source: 'manual_short_term',
          dedupeAgainstLast: false,
        });

        if (!created) {
          throw new NotFoundException('Manual short-term memory could not be created.');
        }

        return this.mapShortTermItem(created);
      }
      case 'longTerm': {
        const created = await this.clientMemoryService.createManualFact({
          companyId: params.companyId,
          contactId: params.contactId,
          conversationId: params.conversationId,
          title: params.title,
          content: params.content,
        });

        return {
          id: created.id,
          title: params.title,
          content: created.value,
          type: 'longTerm',
          updatedAt: created.updatedAt.toISOString(),
          isEditable: true,
        };
      }
      case 'operational': {
        const created = await this.contactMemoryService.upsert({
          companyId: params.companyId,
          contactId: params.contactId,
          conversationId: params.conversationId,
          key: `manual_${Date.now()}`,
          value: params.content,
          stateType: 'manual_note',
          metadataJson: { title: params.title, isEditable: true },
        });

        return {
          id: created.id,
          title: params.title,
          content: created.value,
          type: 'operational',
          updatedAt: created.updatedAt.toISOString(),
          isEditable: true,
        };
      }
    }
  }

  async updateManualMemory(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    memoryId: string;
    type?: 'shortTerm' | 'longTerm' | 'operational';
    title?: string;
    content?: string;
  }): Promise<MemoryManualItem> {
    const type = params.type ?? (await this.detectManualMemoryType(params.companyId, params.contactId, params.conversationId, params.memoryId));

    switch (type) {
      case 'shortTerm': {
        const updated = await this.conversationMemoryService.updateManualShortTermNote(
          params.companyId,
          params.conversationId,
          params.memoryId,
          params.title,
          params.content,
        );

        return this.mapShortTermItem(updated);
      }
      case 'longTerm': {
        const updated = await this.clientMemoryService.updateManualFact(
          params.companyId,
          params.contactId,
          params.memoryId,
          params.title,
          params.content,
        );

        return {
          id: updated.id,
          title: (updated.metadata['title'] as string | undefined) || updated.key,
          content: updated.value,
          type: 'longTerm',
          updatedAt: updated.updatedAt.toISOString(),
          isEditable: true,
        };
      }
      case 'operational': {
        const updated = await this.contactMemoryService.updateManualOperationalNote(
          params.companyId,
          params.contactId,
          params.memoryId,
          params.title,
          params.content,
        );

        return {
          id: updated.id,
          title: (updated.metadataJson['title'] as string | undefined) || updated.key,
          content: updated.value,
          type: 'operational',
          updatedAt: updated.updatedAt.toISOString(),
          isEditable: true,
        };
      }
    }
  }

  async deleteManualMemory(params: {
    companyId: string;
    contactId: string;
    conversationId: string;
    memoryId: string;
  }): Promise<void> {
    const type = await this.detectManualMemoryType(params.companyId, params.contactId, params.conversationId, params.memoryId);

    switch (type) {
      case 'shortTerm':
        await this.conversationMemoryService.deleteManualShortTermNote(params.companyId, params.conversationId, params.memoryId);
        break;
      case 'longTerm':
        await this.clientMemoryService.deleteManualFact(params.companyId, params.contactId, params.memoryId);
        break;
      case 'operational':
        await this.contactMemoryService.deleteManualOperationalNote(params.companyId, params.contactId, params.memoryId);
        break;
    }
  }

  private async detectManualMemoryType(
    companyId: string,
    contactId: string,
    conversationId: string,
    memoryId: string,
  ): Promise<'shortTerm' | 'longTerm' | 'operational'> {
    const [shortTerm, longTerm, operational] = await Promise.all([
      this.conversationMemoryService.getManualShortTermNotes(companyId, conversationId),
      this.clientMemoryService.listByContact(companyId, contactId),
      this.contactMemoryService.list(companyId, contactId),
    ]);

    if (shortTerm.some((item) => item.id === memoryId)) {
      return 'shortTerm';
    }
    if (longTerm.some((item) => item.id === memoryId)) {
      return 'longTerm';
    }
    if (operational.some((item) => item.id === memoryId)) {
      return 'operational';
    }

    this.logger.warn(`Manual memory ${memoryId} was not found during type detection.`);
    throw new NotFoundException(`Memory item ${memoryId} was not found.`);
  }

  private mapShortTermItem(item: ConversationMemoryEntity): MemoryManualItem {
    return {
      id: item.id,
      title: (item.metadataJson['title'] as string | undefined) || 'Nota de memoria',
      content: item.content,
      type: 'shortTerm',
      updatedAt: item.updatedAt.toISOString(),
      isEditable: true,
    };
  }
}
