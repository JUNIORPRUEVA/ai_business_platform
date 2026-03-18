import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { WhatsappMessagingService } from './modules/whatsapp-channel/services/whatsapp-messaging.service';
import { WhatsappWebhookService } from './modules/whatsapp-channel/services/whatsapp-webhook.service';
import { WhatsappInstancesService } from './modules/whatsapp-instances/services/whatsapp-instances.service';

class InMemoryRepository<T extends { id?: string; createdAt?: Date; updatedAt?: Date }> {
  constructor(private readonly items: T[] = []) {}

  async findOne(options: { where?: Record<string, unknown>; order?: Record<string, 'ASC' | 'DESC'> }): Promise<T | null> {
    const matches = this.items.filter((item) => this.matches(item, options.where ?? {}));
    if (!options.order) {
      return matches[0] ?? null;
    }

    const [key, direction] = Object.entries(options.order)[0] as [keyof T, 'ASC' | 'DESC'];
    matches.sort((left, right) => {
      const leftValue = left[key] as unknown as Date | string | number | null | undefined;
      const rightValue = right[key] as unknown as Date | string | number | null | undefined;
      const leftComparable = leftValue instanceof Date ? leftValue.getTime() : (leftValue ?? 0);
      const rightComparable = rightValue instanceof Date ? rightValue.getTime() : (rightValue ?? 0);
      if (leftComparable === rightComparable) {
        return 0;
      }
      return direction === 'ASC'
        ? (leftComparable < rightComparable ? -1 : 1)
        : (leftComparable > rightComparable ? -1 : 1);
    });

    return matches[0] ?? null;
  }

  async save(entity: T): Promise<T> {
    const next = {
      ...entity,
      id: entity.id ?? `id-${this.items.length + 1}`,
      createdAt: entity.createdAt ?? new Date(),
      updatedAt: new Date(),
    } as T;
    const index = this.items.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      this.items[index] = next;
    } else {
      this.items.push(next);
    }
    return next;
  }

  create(partial: Partial<T>): T {
    return {
      ...(partial as T),
      id: partial.id ?? `id-${this.items.length + 1}`,
      createdAt: partial.createdAt ?? new Date(),
      updatedAt: partial.updatedAt ?? new Date(),
    } as T;
  }

  private matches(item: T, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, value]) => (item as Record<string, unknown>)[key] === value);
  }
}

test('WhatsappWebhookService procesa messages.upsert con data.messages[] y guarda en el flujo de la UI', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const logs: Array<Record<string, unknown>> = [];
  const savedMessages: Array<Record<string, unknown>> = [];

  const service = new WhatsappWebhookService(
    { add: async () => undefined } as never,
    configsRepository as never,
    { getEntity: async () => config } as never,
    { create: async (entry: Record<string, unknown>) => { logs.push(entry); return entry; } } as never,
    {
      upsertInboundMessage: async (params: Record<string, unknown>) => {
        savedMessages.push(params);
        return {
          id: 'message-1',
          chatId: 'chat-1',
          remoteJid: params['remoteJid'],
          messageType: params['messageType'],
          fromMe: params['fromMe'],
        };
      },
      updateStoredMedia: async () => undefined,
    } as never,
    { downloadRemoteToStorage: async () => null } as never,
  );

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    extraTopLevelField: 'allowed',
    data: {
      type: 'notify',
      messages: [
        {
          key: {
            remoteJid: '5511999999999',
            id: 'wamid-1',
            fromMe: false,
          },
          pushName: 'Marina',
          messageTimestamp: '1710000000',
          message: {
            conversation: 'Hola FULLPOS',
          },
        },
      ],
    },
  };

  const result = await service.processNow('company-1', payload);

  assert.equal(result.savedMessages.length, 1);
  assert.equal(savedMessages.length, 1);
  assert.equal(savedMessages[0]['remoteJid'], '5511999999999@s.whatsapp.net');
  assert.equal(savedMessages[0]['pushName'], 'Marina');
  assert.equal(savedMessages[0]['evolutionMessageId'], 'wamid-1');
  assert.equal(savedMessages[0]['messageType'], 'text');
  assert.equal(savedMessages[0]['textBody'], 'Hola FULLPOS');
  assert.equal(logs.length, 1);
  assert.equal(logs[0]['eventName'], 'MESSAGES_UPSERT');
});

test('WhatsappInstancesService normaliza payloads inbound con data.messages[] y resuelve instancia empresa y Bot Center', async () => {
  const instance = {
    id: 'instance-1',
    tenantId: 'company-1',
    instanceName: 'demo-instance',
    status: 'connected',
    qrCode: null,
    phoneNumber: null,
    sessionData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    webhookUrl: 'https://example.com/webhook/evolution',
    lastSyncAt: new Date(),
  };
  const instancesRepository = new InMemoryRepository([instance]);
  const configRepository = new InMemoryRepository([config]);
  const logRepository = new InMemoryRepository([]);
  const messageRepository = new InMemoryRepository([]);
  const chatRepository = new InMemoryRepository([]);
  const mirroredPayloads: Array<Record<string, unknown>> = [];
  const botCenterPayloads: Array<Record<string, unknown>> = [];

  const service = new WhatsappInstancesService(
    instancesRepository as never,
    { findOne: async () => ({ payload: { whatsapp: {} } }) } as never,
    configRepository as never,
    logRepository as never,
    chatRepository as never,
    messageRepository as never,
    {
      getRuntimeSettingsSnapshot: async () => ({ baseUrl: 'https://evolution.example.com', apiKey: 'secret' }),
      buildInstanceWebhookUrl: () => 'https://app.example.com/webhook/evolution',
    } as never,
    { get: () => undefined } as never,
    { getByInstanceNameUnsafe: async () => ({ id: 'channel-1' }) } as never,
    {
      processIncomingMessage: async (params: Record<string, unknown>) => {
        botCenterPayloads.push(params);
        return { normalizedMessage: {}, orchestration: { queued: true } };
      },
    } as never,
    { upsertAutomationConfig: async () => config } as never,
    {
      processNow: async (_companyId: string, payload: Record<string, unknown>) => {
        mirroredPayloads.push(payload);
        return { processed: true, configId: 'config-1', savedMessages: [] };
      },
    } as never,
  );

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      type: 'notify',
      messages: [
        {
          key: {
            remoteJid: '5511888888888@s.whatsapp.net',
            id: 'wamid-2',
            fromMe: false,
          },
          pushName: 'Lucia',
          message: {
            conversation: 'Necesito ayuda',
          },
        },
      ],
    },
  };

  const result = await service.applyWebhook(payload);

  assert.equal(result['updated'], true);
  assert.equal(result['instanceName'], 'demo-instance');
  assert.equal(result['mirroredMessages'], 1);
  assert.equal(result['botCenterMessages'], 1);
  assert.equal(mirroredPayloads.length, 1);
  assert.equal(botCenterPayloads.length, 1);
  assert.equal(
    ((mirroredPayloads[0]['data'] as Record<string, unknown>)['messages'] as Array<unknown>).length,
    1,
  );
  assert.equal(
    (((botCenterPayloads[0]['payload'] as Record<string, unknown>)['data'] as Record<string, unknown>)['pushName']),
    'Lucia',
  );
  assert.equal(
    ((((botCenterPayloads[0]['payload'] as Record<string, unknown>)['data'] as Record<string, unknown>)['key'] as Record<string, unknown>)['id']),
    'wamid-2',
  );
});

test('WhatsappWebhookService extrae canonicalRemoteJid desde data.contacts[].wa_id cuando remoteJid es @lid', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const savedMessages: Array<Record<string, unknown>> = [];

  const service = new WhatsappWebhookService(
    { add: async () => undefined } as never,
    configsRepository as never,
    { getEntity: async () => config } as never,
    { create: async () => ({}) } as never,
    {
      upsertInboundMessage: async (params: Record<string, unknown>) => {
        savedMessages.push(params);
        return {
          id: 'message-1',
          chatId: 'chat-1',
          remoteJid: params['remoteJid'],
          messageType: params['messageType'],
          fromMe: params['fromMe'],
        };
      },
      updateStoredMedia: async () => undefined,
    } as never,
    { downloadRemoteToStorage: async () => null } as never,
  );

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      contacts: [{ wa_id: '8295344286' }],
      messages: [
        {
          key: {
            remoteJid: '203040820879420@lid',
            id: 'wamid-3',
            fromMe: false,
          },
          pushName: 'Cliente',
          message: { conversation: 'hola' },
        },
      ],
    },
  };

  await service.processNow('company-1', payload as never);

  assert.equal(savedMessages.length, 1);
  assert.equal(savedMessages[0]['remoteJid'], '203040820879420@lid');
  assert.equal(savedMessages[0]['canonicalRemoteJid'], '18295344286@s.whatsapp.net');
});

test('WhatsappWebhookService extrae canonicalRemoteJid desde data.sender numerico cuando remoteJid es @lid', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const savedMessages: Array<Record<string, unknown>> = [];

  const service = new WhatsappWebhookService(
    { add: async () => undefined } as never,
    configsRepository as never,
    { getEntity: async () => config } as never,
    { create: async () => ({}) } as never,
    {
      upsertInboundMessage: async (params: Record<string, unknown>) => {
        savedMessages.push(params);
        return {
          id: 'message-1',
          chatId: 'chat-1',
          remoteJid: params['remoteJid'],
          messageType: params['messageType'],
          fromMe: params['fromMe'],
        };
      },
      updateStoredMedia: async () => undefined,
    } as never,
    { downloadRemoteToStorage: async () => null } as never,
  );

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      sender: '+1 (829) 534-4286',
      messages: [
        {
          key: {
            remoteJid: '234840490270800@lid',
            id: 'wamid-4',
            fromMe: false,
          },
          pushName: 'Cliente',
          message: { conversation: 'hola' },
        },
      ],
    },
  };

  await service.processNow('company-1', payload as never);

  assert.equal(savedMessages.length, 1);
  assert.equal(savedMessages[0]['remoteJid'], '234840490270800@lid');
  assert.equal(savedMessages[0]['canonicalRemoteJid'], '18295344286@s.whatsapp.net');
});

test('WhatsappMessagingService resuelve destinatario canonico desde last inbound payload usando data.sender numerico', async () => {
  const remoteJid = '234840490270800@lid';
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      remoteJid,
      canonicalRemoteJid: null,
      canonicalNumber: null,
      sendTarget: null,
      replyTargetUnresolved: true,
      createdAt: new Date('2026-03-18T18:00:00.000Z'),
      updatedAt: new Date('2026-03-18T18:00:00.000Z'),
    },
  ]);
  const messagesRepository = new InMemoryRepository([
    {
      id: 'message-1',
      companyId: 'company-1',
      remoteJid,
      direction: 'inbound',
      rawPayloadJson: {
        data: {
          key: { remoteJid, id: 'wamid-5', fromMe: false },
          sender: '+1 (829) 534-4286',
          message: { conversation: 'hola' },
        },
      },
      createdAt: new Date('2026-03-18T18:05:00.000Z'),
      updatedAt: new Date('2026-03-18T18:05:00.000Z'),
    },
  ]);

  const service = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await service.diagnoseRecipientResolution('company-1', remoteJid);
  const updatedChat = await chatsRepository.findOne({ where: { id: 'chat-1', companyId: 'company-1' } });

  assert.equal(result.safeToSend, true);
  assert.equal(result.canonicalJid, '18295344286@s.whatsapp.net');
  assert.equal(result.canonicalNumber, '18295344286');
  assert.equal(result.source, 'last_inbound_payload');
  assert.equal(updatedChat?.canonicalRemoteJid, '18295344286@s.whatsapp.net');
  assert.equal(updatedChat?.canonicalNumber, '18295344286');
  assert.equal(updatedChat?.sendTarget, '18295344286');
  assert.equal(updatedChat?.replyTargetUnresolved, false);
});