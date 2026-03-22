import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { ClientMemoryService } from './modules/ai-engine/client-memory.service';
import { ContactMemoryService } from './modules/ai-engine/contact-memory.service';
import { ConversationMemoryService } from './modules/ai-engine/conversation-memory.service';
import { ConversationSummaryService } from './modules/ai-engine/conversation-summary.service';
import { MemoryCacheService } from './modules/ai-engine/memory-cache.service';
import { MemoryContextAssemblerService } from './modules/ai-engine/memory-context-assembler.service';
import { MemoryDeduplicationService } from './modules/ai-engine/memory-deduplication.service';

class InMemoryRepository<T extends { id?: string; createdAt?: Date; updatedAt?: Date }> {
  items: T[] = [];

  create(partial: Partial<T>): T {
    const now = new Date();
    return {
      ...(partial as T),
      id: partial.id ?? `id-${this.items.length + 1}`,
      createdAt: partial.createdAt ?? now,
      updatedAt: partial.updatedAt ?? now,
    };
  }

  async save(entity: T): Promise<T> {
    const index = this.items.findIndex((item) => item.id === entity.id);
    const next = {
      ...entity,
      createdAt: entity.createdAt ?? new Date(),
      updatedAt: new Date(),
    } as T;

    if (index >= 0) {
      this.items[index] = next;
    } else {
      this.items.push(next);
    }

    return next;
  }

  async find(options?: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'>; take?: number }): Promise<T[]> {
    let result = this.items.filter((item) => this.matches(item, options?.where ?? {}));

    if (options?.order) {
      const [key, direction] = Object.entries(options.order)[0] as [keyof T, 'ASC' | 'DESC'];
      result = result.sort((left, right) => {
        const leftValue = left[key] as unknown as string | number | Date;
        const rightValue = right[key] as unknown as string | number | Date;
        const leftComparable = leftValue instanceof Date ? leftValue.getTime() : leftValue;
        const rightComparable = rightValue instanceof Date ? rightValue.getTime() : rightValue;
        if (leftComparable === rightComparable) return 0;
        return direction === 'ASC'
          ? (leftComparable < rightComparable ? -1 : 1)
          : (leftComparable > rightComparable ? -1 : 1);
      });
    }

    if (options?.take != null) {
      result = result.slice(0, options.take);
    }

    return result;
  }

  async findOne(options: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'> }): Promise<T | null> {
    const [item] = await this.find({ where: options.where, order: options.order, take: 1 });
    return item ?? null;
  }

  async count(options?: { where?: Record<string, unknown> }): Promise<number> {
    return this.items.filter((item) => this.matches(item, options?.where ?? {})).length;
  }

  async delete(criteria: Record<string, unknown>): Promise<void> {
    this.items = this.items.filter((item) => !this.matches(item, criteria));
  }

  merge(entity: T, partial: Partial<T>): T {
    return { ...entity, ...partial };
  }

  createQueryBuilder(): any {
    const state: {
      predicates: Array<(item: T) => boolean>;
      limit?: number;
      orderBy?: keyof T;
      orderDirection?: 'ASC' | 'DESC';
      updateIds?: string[];
    } = { predicates: [] };

    const api = {
      where: (_query: unknown, params?: Record<string, unknown>) => {
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (key === 'companyId') state.predicates.push((item) => (item as Record<string, unknown>)['companyId'] === value);
            if (key === 'conversationId') state.predicates.push((item) => (item as Record<string, unknown>)['conversationId'] === value);
            if (key === 'conversationId') state.predicates.push((item) => (item as Record<string, unknown>)['conversationId'] === value);
            if (key === 'metadataValue') state.predicates.push((item) => ((item as Record<string, unknown>)['metadata'] as Record<string, unknown> | undefined)?.[String(params?.metadataKey)] === value);
          });
        }
        return api;
      },
      andWhere: (query: unknown, params?: Record<string, unknown>) => {
        if (typeof query === 'string' && query.includes('created_at <') && params?.cutoff) {
          const cutoff = new Date(String(params.cutoff)).getTime();
          state.predicates.push((item) => (item.createdAt?.getTime() ?? 0) < cutoff);
        }
        if (typeof query === 'string' && query.includes('created_at >') && params?.sinceCreatedAt) {
          const since = new Date(String(params.sinceCreatedAt)).getTime();
          state.predicates.push((item) => (item.createdAt?.getTime() ?? 0) > since);
        }
        if (typeof query === 'string' && query.includes("source <> 'manual_short_term'")) {
          state.predicates.push((item) => (item as Record<string, unknown>)['source'] !== 'manual_short_term');
        }
        if (typeof query === 'string' && query.includes('metadata ->>') && params?.metadataKey && params?.metadataValue) {
          state.predicates.push((item) => ((item as Record<string, unknown>)['metadata'] as Record<string, unknown> | undefined)?.[String(params.metadataKey)] === params.metadataValue);
        }
        return api;
      },
      orderBy: (field: string, direction: 'ASC' | 'DESC') => {
        state.orderBy = field.replace('memory.', '').replace('message.', '') as keyof T;
        state.orderDirection = direction;
        return api;
      },
      limit: (value: number) => {
        state.limit = value;
        return api;
      },
      getMany: async () => {
        let result = this.items.filter((item) => state.predicates.every((predicate) => predicate(item)));
        if (state.orderBy) {
          result = result.sort((left, right) => {
            const leftValue = left[state.orderBy!] as unknown as Date | string;
            const rightValue = right[state.orderBy!] as unknown as Date | string;
            const leftComparable = leftValue instanceof Date ? leftValue.getTime() : String(leftValue);
            const rightComparable = rightValue instanceof Date ? rightValue.getTime() : String(rightValue);
            if (leftComparable === rightComparable) return 0;
            return state.orderDirection === 'ASC'
              ? (leftComparable < rightComparable ? -1 : 1)
              : (leftComparable > rightComparable ? -1 : 1);
          });
        }
        if (state.limit != null) {
          result = result.slice(0, state.limit);
        }
        return result;
      },
      getOne: async () => {
        const items = await api.getMany();
        return items[0] ?? null;
      },
      update: () => api,
      set: () => api,
      whereInIds: (ids: string[]) => {
        state.updateIds = ids;
        return api;
      },
      execute: async () => {
        if (state.updateIds) {
          this.items = this.items.map((item) =>
            state.updateIds?.includes(String(item.id))
              ? ({ ...item, compactedAt: new Date() } as T)
              : item,
          );
        }
      },
    };

    return api;
  }

  private matches(item: T, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return (item as Record<string, unknown>)[key] == null;
      }
      return (item as Record<string, unknown>)[key] === value;
    });
  }
}

class NoopCacheService {
  private readonly store = new Map<string, unknown>();

  recentWindowKey(companyId: string, conversationId: string): string {
    return `recent:${companyId}:${conversationId}`;
  }

  summaryKey(companyId: string, conversationId: string): string {
    return `summary:${companyId}:${conversationId}`;
  }

  operationalKey(companyId: string, contactId: string): string {
    return `operational:${companyId}:${contactId}`;
  }

  idempotencyKey(companyId: string, scope: string, value: string): string {
    return `idempotency:${companyId}:${scope}:${value}`;
  }

  async getJson<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T | undefined) ?? null;
  }

  async setJson(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async acquireIdempotency(key: string): Promise<boolean> {
    if (this.store.has(key)) {
      return false;
    }
    this.store.set(key, true);
    return true;
  }
}

test('conversation memory saves inbound messages and deduplicates repeated events', async () => {
  const repository = new InMemoryRepository<any>();
  const service = new ConversationMemoryService(
    repository as never,
    new NoopCacheService() as never,
    new MemoryDeduplicationService(),
  );

  await service.append({
    companyId: 'company-a',
    contactId: 'contact-1',
    conversationId: 'conversation-1',
    role: 'user',
    content: 'Hola',
    source: 'inbound_message',
    contentType: 'text',
    messageId: 'msg-1',
    eventId: 'event-1',
    dedupeAgainstLast: true,
  });
  await service.append({
    companyId: 'company-a',
    contactId: 'contact-1',
    conversationId: 'conversation-1',
    role: 'user',
    content: 'Hola',
    source: 'inbound_message',
    contentType: 'text',
    messageId: 'msg-1',
    eventId: 'event-1',
    dedupeAgainstLast: true,
  });

  assert.equal(repository.items.length, 1);
});

test('conversation memory stores assistant responses separately', async () => {
  const repository = new InMemoryRepository<any>();
  const service = new ConversationMemoryService(
    repository as never,
    new NoopCacheService() as never,
    new MemoryDeduplicationService(),
  );

  await service.append({
    companyId: 'company-a',
    contactId: 'contact-1',
    conversationId: 'conversation-1',
    role: 'assistant',
    content: 'Respuesta',
    source: 'assistant_response',
    contentType: 'text',
    messageId: 'msg-2',
  });

  assert.equal(repository.items[0].role, 'assistant');
  assert.equal(repository.items[0].source, 'assistant_response');
});

test('client memory upserts extracted facts', async () => {
  const memories = new InMemoryRepository<any>();
  const contacts = new InMemoryRepository<any>();
  contacts.items.push({ id: 'contact-1', companyId: 'company-a', name: null, email: null, createdAt: new Date(), updatedAt: new Date() });
  const service = new ClientMemoryService(memories as never, contacts as never);

  await service.upsertFacts({
    companyId: 'company-a',
    contactId: 'contact-1',
    conversationId: 'conversation-1',
    items: [
      { key: 'customer_name', value: 'Lucia', category: 'profile', confidence: 0.9 },
    ],
  });

  assert.equal(memories.items.length, 1);
  assert.equal(memories.items[0].value, 'Lucia');
  assert.equal(contacts.items[0].name, 'Lucia');
});

test('contact memory stores operational state with tenant isolation', async () => {
  const repository = new InMemoryRepository<any>();
  const service = new ContactMemoryService(repository as never, new NoopCacheService() as never);

  await service.upsert({
    companyId: 'company-a',
    contactId: 'contact-1',
    conversationId: 'conversation-1',
    key: 'stage',
    value: 'qualified',
    stateType: 'operational',
  });
  await service.upsert({
    companyId: 'company-b',
    contactId: 'contact-1',
    conversationId: 'conversation-2',
    key: 'stage',
    value: 'new',
    stateType: 'operational',
  });

  const companyAMap = await service.getMap('company-a', 'contact-1');
  assert.equal(companyAMap.stage, 'qualified');
  assert.equal(repository.items.length, 2);
});

test('conversation summary refreshes when threshold is exceeded', async () => {
  const summaryRepo = new InMemoryRepository<any>();
  const cache = new NoopCacheService();
  const conversationMemoryService = {
    listSummaryCandidates: async () => [
      { id: '1', role: 'user', content: 'Necesito precios', source: 'inbound_message', messageId: 'm1' },
      { id: '2', role: 'assistant', content: 'Te comparto opciones', source: 'assistant_response', messageId: 'm2' },
      { id: '3', role: 'tool', content: 'Tool executed', source: 'tool_execution', messageId: 'm3' },
    ],
    compactRecords: async (_ids: string[]) => undefined,
  };
  const clientMemoryService = {
    listByContact: async () => [
      { key: 'customer_name', value: 'Lucia', category: 'profile' },
    ],
  };
  const service = new ConversationSummaryService(
    summaryRepo as never,
    conversationMemoryService as never,
    clientMemoryService as never,
    cache as never,
  );

  const summary = await service.refreshIfNeeded({
    companyId: 'company-a',
    contactId: 'contact-1',
    conversationId: 'conversation-1',
    recentWindowSize: 2,
    summaryRefreshThreshold: 2,
  });

  assert.ok(summary);
  assert.match(summary!.summaryText, /Resumen persistente/);
});

test('memory context assembler orders summary, facts, state, and recent window', () => {
  const assembler = new MemoryContextAssemblerService();
  const context = assembler.assemble({
    summaryText: 'Resumen previo',
    keyFacts: [{ key: 'customer_name', value: 'Lucia', category: 'profile' }],
    operationalState: [{ key: 'stage', value: 'qualified' }],
    recentWindow: [{ role: 'assistant', source: 'assistant_response', content: 'Ultima respuesta' }],
    incomingMessage: 'Mensaje nuevo',
  });

  assert.match(context, /1\. Summary persistente:[\s\S]*Resumen previo/);
  assert.match(context, /2\. Key facts del cliente:[\s\S]*customer_name/);
  assert.match(context, /3\. Estado operativo actual:[\s\S]*qualified/);
  assert.match(context, /4\. Ventana reciente:[\s\S]*Ultima respuesta/);
  assert.match(context, /5\. Mensaje nuevo entrante:[\s\S]*Mensaje nuevo/);
});

test('memory cache gracefully falls back when Redis is unavailable', async () => {
  const service = new MemoryCacheService({
    get: () => '',
  } as never);

  const cached = await service.getJson('missing');
  assert.equal(cached, null);
  const acquired = await service.acquireIdempotency('no-redis', 60);
  assert.equal(acquired, true);
});

test('deduplication service generates stable event keys', () => {
  const service = new MemoryDeduplicationService();
  const left = service.buildEventKey({
    channel: 'whatsapp',
    senderId: '5511999999999',
    externalMessageId: 'abc',
    timestamp: '2026-03-17T10:00:00Z',
    type: 'text',
    content: 'hola',
  });
  const right = service.buildEventKey({
    channel: 'whatsapp',
    senderId: '5511999999999',
    externalMessageId: 'abc',
    timestamp: '2026-03-17T10:00:00Z',
    type: 'text',
    content: 'hola',
  });

  assert.equal(left, right);
});

test('deduplication service accepts numeric timestamps without trim failures', () => {
  const service = new MemoryDeduplicationService();

  const result = service.buildEventKey({
    channel: 'whatsapp',
    senderId: '5511999999999',
    externalMessageId: 'abc',
    timestamp: 1774153781 as unknown as string,
    type: 'text',
    content: 'hola',
  });

  assert.equal(typeof result, 'string');
  assert.equal(result.length > 0, true);
});