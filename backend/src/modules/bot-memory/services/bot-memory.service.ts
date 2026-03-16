import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { JsonFileStoreService } from '../../../common/persistence/json-file-store.service';
import {
  BotMemoryStore,
  ConversationMemoryRecord,
  ConversationSummaryRecord,
  createDefaultBotMemoryStore,
  MemoryContextResult,
  MemoryLookupResult,
  OperationalStateRecord,
} from '../types/bot-memory.types';

@Injectable()
export class BotMemoryService implements OnModuleInit {
  private state!: BotMemoryStore;

  constructor(private readonly fileStore: JsonFileStoreService) {}

  async onModuleInit(): Promise<void> {
    this.state = await this.fileStore.readOrCreate(
      'bot-memory.json',
      createDefaultBotMemoryStore,
    );
  }

  async saveIncomingMessageMemory(input: {
    conversationId: string;
    senderId: string;
    channel: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConversationMemoryRecord> {
    const record: ConversationMemoryRecord = {
      id: randomUUID(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      channel: input.channel,
      direction: 'incoming',
      content: input.content,
      createdAt: new Date().toISOString(),
      metadata: input.metadata,
    };
    this.state.messageRecords.push(record);
    await this.persist();
    return structuredClone(record);
  }

  async saveOutgoingMessageMemory(input: {
    conversationId: string;
    senderId: string;
    channel: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<ConversationMemoryRecord> {
    const record: ConversationMemoryRecord = {
      id: randomUUID(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      channel: input.channel,
      direction: 'outgoing',
      content: input.content,
      createdAt: new Date().toISOString(),
      metadata: input.metadata,
    };
    this.state.messageRecords.push(record);
    await this.persist();
    return structuredClone(record);
  }

  async saveConversationSummary(input: {
    conversationId: string;
    summary: string;
    generatedFromMessages: number;
  }): Promise<ConversationSummaryRecord> {
    const existingIndex = this.state.conversationSummaries.findIndex(
      (item) => item.conversationId === input.conversationId,
    );

    const record: ConversationSummaryRecord = {
      id:
        existingIndex === -1
          ? randomUUID()
          : this.state.conversationSummaries[existingIndex].id,
      conversationId: input.conversationId,
      summary: input.summary,
      generatedFromMessages: input.generatedFromMessages,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex === -1) {
      this.state.conversationSummaries.push(record);
    } else {
      this.state.conversationSummaries[existingIndex] = record;
    }

    await this.persist();
    return structuredClone(record);
  }

  async saveOperationalState(input: {
    conversationId: string;
    stage: string;
    lastIntent?: string;
    assignedTool?: string;
    needsHumanEscalation: boolean;
  }): Promise<OperationalStateRecord> {
    const existingIndex = this.state.operationalStates.findIndex(
      (item) => item.conversationId === input.conversationId,
    );

    const record: OperationalStateRecord = {
      id:
        existingIndex === -1
          ? randomUUID()
          : this.state.operationalStates[existingIndex].id,
      conversationId: input.conversationId,
      stage: input.stage,
      lastIntent: input.lastIntent,
      assignedTool: input.assignedTool,
      needsHumanEscalation: input.needsHumanEscalation,
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex === -1) {
      this.state.operationalStates.push(record);
    } else {
      this.state.operationalStates[existingIndex] = record;
    }

    await this.persist();
    return structuredClone(record);
  }

  async createManualMemory(input: {
    conversationId: string;
    scope: 'shortTerm' | 'longTerm' | 'operational';
    title: string;
    content: string;
  }) {
    const record = {
      id: randomUUID(),
      conversationId: input.conversationId,
      scope: input.scope,
      title: input.title,
      content: input.content,
      updatedAt: new Date().toISOString(),
    };

    this.state.manualMemoryItems.push(record);
    await this.persist();
    return structuredClone(record);
  }

  async updateManualMemory(
    memoryId: string,
    input: {
      title?: string;
      content?: string;
      scope?: 'shortTerm' | 'longTerm' | 'operational';
    },
  ) {
    const index = this.state.manualMemoryItems.findIndex(
      (item) => item.id === memoryId,
    );

    if (index == -1) {
      throw new NotFoundException(`Memory item ${memoryId} was not found.`);
    }

    this.state.manualMemoryItems[index] = {
      ...this.state.manualMemoryItems[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };

    await this.persist();
    return structuredClone(this.state.manualMemoryItems[index]);
  }

  async deleteManualMemory(memoryId: string): Promise<void> {
    const nextItems = this.state.manualMemoryItems.filter(
      (item) => item.id !== memoryId,
    );

    if (nextItems.length == this.state.manualMemoryItems.length) {
      throw new NotFoundException(`Memory item ${memoryId} was not found.`);
    }

    this.state.manualMemoryItems = nextItems;
    await this.persist();
  }

  getShortTermMemory(conversationId: string, limit = 12): MemoryLookupResult[] {
    return this.state.messageRecords
      .filter((item) => item.conversationId === conversationId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit)
      .map((item, index) => ({
        id: item.id,
        scope: 'shortTerm',
        title: item.direction === 'incoming' ? 'Incoming message' : 'Outgoing draft',
        content: item.content,
        relevanceScore: Math.max(0.55, 0.95 - index * 0.05),
        createdAt: item.createdAt,
      }));
  }

  getLongTermMemory(conversationId: string): MemoryLookupResult[] {
    const summary = this.state.conversationSummaries.find(
      (item) => item.conversationId === conversationId,
    );

    const summaryLookup: MemoryLookupResult[] = summary
      ? [
          {
            id: summary.id,
            scope: 'longTerm',
            title: 'Conversation summary',
            content: summary.summary,
            relevanceScore: 0.88,
            createdAt: summary.updatedAt,
          },
        ]
      : [];

    return [...summaryLookup, ...this.state.longTermFacts].map((item) =>
      structuredClone(item),
    );
  }

  getOperationalMemory(conversationId: string): OperationalStateRecord | null {
    const state = this.state.operationalStates.find(
      (item) => item.conversationId === conversationId,
    );
    return state ? structuredClone(state) : null;
  }

  buildMemoryContext(conversationId: string): MemoryContextResult {
    const manualItems = this.state.manualMemoryItems.filter(
      (item) => item.conversationId === conversationId,
    );
    const manualShortTerm: MemoryLookupResult[] = manualItems
      .filter((item) => item.scope === 'shortTerm')
      .map((item) => ({
        id: item.id,
        scope: item.scope,
        title: item.title,
        content: item.content,
        relevanceScore: 0.98,
        createdAt: item.updatedAt,
        isEditable: true,
      }));
    const manualLongTerm: MemoryLookupResult[] = manualItems
      .filter((item) => item.scope === 'longTerm')
      .map((item) => ({
        id: item.id,
        scope: item.scope,
        title: item.title,
        content: item.content,
        relevanceScore: 0.96,
        createdAt: item.updatedAt,
        isEditable: true,
      }));
    const manualOperational: MemoryLookupResult[] = manualItems
      .filter((item) => item.scope === 'operational')
      .map((item) => ({
        id: item.id,
        scope: item.scope,
        title: item.title,
        content: item.content,
        relevanceScore: 0.97,
        createdAt: item.updatedAt,
        isEditable: true,
      }));
    const shortTerm = [...manualShortTerm, ...this.getShortTermMemory(conversationId)];
    const longTerm = [...manualLongTerm, ...this.getLongTermMemory(conversationId)];
    const operationalState = this.getOperationalMemory(conversationId);
    const operational: MemoryLookupResult[] = [
      ...manualOperational,
      ...(operationalState != null
        ? [
            {
              id: operationalState.id,
              scope: 'operational' as const,
              title: 'Operational state',
              content: `Stage=${operationalState.stage}; intent=${operationalState.lastIntent ?? 'unknown'}; tool=${operationalState.assignedTool ?? 'none'}; escalation=${operationalState.needsHumanEscalation}`,
              relevanceScore: 0.9,
              createdAt: operationalState.updatedAt,
            },
          ]
        : []),
    ];
    const summary = this.state.conversationSummaries.find(
      (item) => item.conversationId === conversationId,
    );

    const formattedContext = [
      'Short-term memory:',
      ...shortTerm.map((item) => `- ${item.content}`),
      'Long-term memory:',
      ...longTerm.map((item) => `- ${item.content}`),
      'Operational memory:',
      ...operational.map((item) => `- ${item.content}`),
    ].join('\n');

    return {
      conversationId,
      shortTerm,
      longTerm,
      operational,
      summary: summary ? structuredClone(summary) : undefined,
      formattedContext,
    };
  }

  getStats() {
    return {
      messageRecords: this.state.messageRecords.length,
      summaries: this.state.conversationSummaries.length,
      operationalStates: this.state.operationalStates.length,
      longTermFacts: this.state.longTermFacts.length,
      manualMemoryItems: this.state.manualMemoryItems.length,
    };
  }

  private async persist(): Promise<void> {
    await this.fileStore.write('bot-memory.json', this.state);
  }
}