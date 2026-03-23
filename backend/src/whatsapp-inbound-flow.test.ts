import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { EvolutionApiClientService } from './modules/whatsapp-channel/services/evolution-api-client.service';
import { WhatsappAttachmentService } from './modules/whatsapp-channel/services/whatsapp-attachment.service';
import { WhatsappChatEntity } from './modules/whatsapp-channel/entities/whatsapp-chat.entity';
import { WhatsappMessageEntity } from './modules/whatsapp-channel/entities/whatsapp-message.entity';
import { WhatsappMessagingService } from './modules/whatsapp-channel/services/whatsapp-messaging.service';
import { WhatsappJidResolverService } from './modules/whatsapp-channel/services/whatsapp-jid-resolver.service';
import { WhatsappWebhookService } from './modules/whatsapp-channel/services/whatsapp-webhook.service';
import { WhatsappChannelConfigService } from './modules/whatsapp-channel/services/whatsapp-channel-config.service';
import { WhatsappInstancesService } from './modules/whatsapp-instances/services/whatsapp-instances.service';
import { EvolutionWebhookService } from './modules/evolution-webhook/services/evolution-webhook.service';
import { BotCenterService } from './modules/bot-center/services/bot-center.service';
import { EvolutionService } from './modules/evolution/evolution.service';

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

const emptyEvolutionApiClient = {
  findContacts: async () => ({}),
  findChats: async () => ({}),
};

const jidResolverStub = {
  normalizeRemoteJid: (value: string) => (value.includes('@') ? value : `${value.replace(/\D/g, '')}@s.whatsapp.net`),
  normalizeJid: (value: string) => (value.includes('@') ? value : `${value.replace(/\D/g, '')}@s.whatsapp.net`),
  normalizeReplyJid: (value: string) => {
    const normalized = value.includes('@') ? value : `${value.replace(/\D/g, '')}@s.whatsapp.net`;
    if (!normalized.endsWith('@lid')) {
      return normalized;
    }
    const digits = normalized.replace(/@.+$/, '').replace(/\D/g, '');
    return `${digits}@s.whatsapp.net`;
  },
  normalizeCanonicalRemoteJid: (value?: string | null) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed || !trimmed.endsWith('@s.whatsapp.net')) {
      return null;
    }
    const digits = trimmed.replace(/@.+$/, '').replace(/\D/g, '');
    const normalized = digits.length === 10 ? `1${digits}` : digits;
    return normalized ? `${normalized}@s.whatsapp.net` : null;
  },
  extractPhoneFromJid: (jid: string) => jid.replace(/@.+$/, '').replace(/\D/g, ''),
  jidToNumber: (jid: string) => jid.replace(/@.+$/, '').replace(/\D/g, ''),
  normalizeOutboundNumber: (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits.length === 10 ? `1${digits}` : digits;
  },
  detectJidType: (jid: string) =>
    jid.endsWith('@lid') ? 'lid' : jid.endsWith('@s.whatsapp.net') ? 'pn' : jid.endsWith('@g.us') ? 'group' : 'unknown',
  extractCanonicalRemoteJid: (
    data: Record<string, unknown>,
    key: Record<string, unknown>,
    _message: Record<string, unknown>,
    _remoteJid: string,
  ) => {
    const directSender = typeof data['sender'] === 'string' ? data['sender'] : '';
    const source = (data['source'] ?? {}) as Record<string, unknown>;
    const sourcePhone = typeof source['sender'] === 'string'
      ? source['sender']
      : typeof source['senderPn'] === 'string'
        ? source['senderPn']
        : typeof source['phoneNumber'] === 'string'
          ? source['phoneNumber']
          : '';
    const contactWaId = Array.isArray(data['contacts'])
      ? (((data['contacts'] as Array<unknown>)[0] as Record<string, unknown> | undefined)?.['wa_id'] as string | undefined) ?? ''
      : '';
    const candidate = directSender || sourcePhone || contactWaId || (typeof key['senderPn'] === 'string' ? key['senderPn'] : '');
    const digits = candidate.replace(/\D/g, '');
    if (digits.length < 10) {
      return null;
    }
    const normalized = digits.length === 10 ? `1${digits}` : digits;
    return `${normalized}@s.whatsapp.net`;
  },
  extractCanonicalRemoteJidFromPayload: (payload: Record<string, unknown>) => {
    const data = (payload['data'] ?? {}) as Record<string, unknown>;
    const source = (data['source'] ?? {}) as Record<string, unknown>;
    const sender = typeof data['sender'] === 'string' ? data['sender'] : '';
    const waId = Array.isArray(data['contacts'])
      ? (((data['contacts'] as Array<unknown>)[0] as Record<string, unknown> | undefined)?.['wa_id'] as string | undefined) ?? ''
      : '';
    const sourceSender = typeof source['sender'] === 'string'
      ? source['sender']
      : typeof source['senderPn'] === 'string'
        ? source['senderPn']
        : typeof source['phoneNumber'] === 'string'
          ? source['phoneNumber']
          : '';
    const phone = sender || sourceSender || waId;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) {
      return null;
    }
    const normalized = digits.length === 10 ? `1${digits}` : digits;
    return `${normalized}@s.whatsapp.net`;
  },
  lookupCanonicalRemoteJidFromEvolution: async (_config: unknown, _remoteJid: string) => null,
};

const botCenterRealtimeStub = {
  publishMessageUpsert: async () => undefined,
  publishMessageStatus: async () => undefined,
  streamCompanyEvents: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }),
};

function createWhatsappWebhookService(params: {
  configsRepository: unknown;
  configService?: unknown;
  logsService?: unknown;
  messagingService: unknown;
  botCenterRealtimeService?: unknown;
  attachmentsService?: unknown;
  evolutionApiClient?: unknown;
  jidResolver?: unknown;
  webhookQueue?: unknown;
  messageProcessingQueue?: unknown;
  chatsRepository?: unknown;
  channelsService?: unknown;
  contactsService?: unknown;
  conversationsService?: unknown;
  appMessagesService?: unknown;
}) {
  const messagingService = (params.messagingService ?? {}) as Record<string, unknown>;
  if (typeof messagingService['findByEvolutionMessageId'] !== 'function') {
    messagingService['findByEvolutionMessageId'] = async () => null;
  }
  if (typeof messagingService['applyStatusUpdate'] !== 'function') {
    messagingService['applyStatusUpdate'] = async () => null;
  }

  return new WhatsappWebhookService(
    (params.webhookQueue ?? { add: async () => undefined }) as never,
    (params.messageProcessingQueue ?? { add: async () => undefined }) as never,
    params.configsRepository as never,
    (params.chatsRepository ?? new InMemoryRepository([])) as never,
    (params.channelsService ?? {
      getByInstanceNameUnsafe: async () => ({ id: 'channel-1', companyId: 'company-1' }),
      findOrCreateWhatsappBridge: async () => ({ id: 'channel-1', companyId: 'company-1' }),
    }) as never,
    (params.contactsService ?? {
      findOrCreateByPhone: async () => ({ id: 'contact-1' }),
    }) as never,
    (params.conversationsService ?? {
      findOrCreateOpen: async () => ({ id: 'conversation-1' }),
    }) as never,
    (params.appMessagesService ?? {
      findByMetadataValue: async () => null,
      create: async (_companyId: string, _conversationId: string, payload: Record<string, unknown>) => ({
        id: 'app-message-1',
        ...payload,
      }),
    }) as never,
    (params.configService ?? { getEntity: async () => null }) as never,
    (params.logsService ?? { create: async (entry: Record<string, unknown>) => entry }) as never,
    messagingService as never,
    (params.botCenterRealtimeService ?? botCenterRealtimeStub) as never,
    (params.attachmentsService ?? { downloadRemoteToStorage: async () => null }) as never,
    (params.evolutionApiClient ?? emptyEvolutionApiClient) as never,
    (params.jidResolver ?? jidResolverStub) as never,
  );
}

Object.assign(emptyEvolutionApiClient, {
  normalizeRemoteJid: jidResolverStub.normalizeRemoteJid,
  extractCanonicalRemoteJid: jidResolverStub.extractCanonicalRemoteJid,
  lookupCanonicalRemoteJidFromEvolution: jidResolverStub.lookupCanonicalRemoteJidFromEvolution,
});

test('WhatsappAttachmentService normaliza extensiones truncadas usando el mime type', () => {
  const service = Object.create(WhatsappAttachmentService.prototype) as WhatsappAttachmentService;
  const resolveExtension = (
    service as unknown as {
      resolveExtension: (originalName: string, mimeType: string | null, fileType: string) => string;
    }
  ).resolveExtension.bind(service);

  assert.equal(resolveExtension('foto.j', 'image/jpeg', 'image'), 'jpg');
  assert.equal(resolveExtension('clip.vid', 'video/mp4', 'video'), 'mp4');
  assert.equal(resolveExtension('voice.a', 'audio/ogg; codecs=opus', 'audio'), 'ogg');
});

test('WhatsappAttachmentService resuelve video/octet-stream como video mp4', () => {
  const service = Object.create(WhatsappAttachmentService.prototype) as WhatsappAttachmentService;
  const resolveMimeType = (
    service as unknown as {
      resolveMimeType: (buffer: Buffer, mimeType: string | null, fileType: string) => string | null;
    }
  ).resolveMimeType.bind(service);

  const mp4Header = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]);
  assert.equal(resolveMimeType(mp4Header, 'application/octet-stream', 'video'), 'video/mp4');
});

test('WhatsappAttachmentService prioriza la firma binaria real cuando el mime declarado del audio no coincide', () => {
  const service = Object.create(WhatsappAttachmentService.prototype) as WhatsappAttachmentService;
  const resolveMimeType = (
    service as unknown as {
      resolveMimeType: (buffer: Buffer, mimeType: string | null, fileType: string) => string | null;
    }
  ).resolveMimeType.bind(service);

  const oggHeader = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]);
  assert.equal(resolveMimeType(oggHeader, 'audio/mpeg', 'audio'), 'audio/ogg');
});

test('WhatsappAttachmentService rechaza blobs octet-stream cifrados como audio reproducible', () => {
  const service = Object.create(WhatsappAttachmentService.prototype) as WhatsappAttachmentService;
  const looksLikePlayableAudio = (
    service as unknown as {
      looksLikePlayableAudio: (buffer: Buffer, mimeType: string | null) => boolean;
    }
  ).looksLikePlayableAudio.bind(service);

  const encryptedLikePayload = Buffer.alloc(4096, 0xab);
  assert.equal(looksLikePlayableAudio(encryptedLikePayload, 'application/octet-stream'), false);
});

test('WhatsappAttachmentService usa el endpoint de Evolution cuando la URL trae audio cifrado no reproducible', async () => {
  const service = Object.create(WhatsappAttachmentService.prototype) as WhatsappAttachmentService;
  Object.assign(service as object, {
    logger: { log: () => undefined, warn: () => undefined, error: () => undefined },
    evolutionApiClient: {
      downloadMediaUrl: async () => ({
        buffer: Buffer.alloc(4096, 0xab),
        contentType: 'application/octet-stream',
      }),
      downloadMediaMessage: async () => ({
        buffer: Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]),
        contentType: 'audio/ogg',
      }),
    },
  });

  const resolveInboundDownload = (
    service as unknown as {
      resolveInboundDownload: (params: {
        config: Record<string, unknown>;
        fileType: string;
        mimeType?: string | null;
        sourceUrl?: string | null;
        messagePayload: Record<string, unknown>;
      }) => Promise<{ buffer: Buffer; contentType: string | null } | null>;
    }
  ).resolveInboundDownload.bind(service);

  const resolved = await resolveInboundDownload({
    config: {},
    fileType: 'audio',
    mimeType: 'audio/ogg; codecs=opus',
    sourceUrl: 'https://mmg.whatsapp.net/fake.enc',
    messagePayload: { audioMessage: { mimetype: 'audio/ogg; codecs=opus' } },
  });

  assert.ok(resolved);
  assert.equal(resolved?.contentType, 'audio/ogg');
  assert.equal(resolved?.buffer.subarray(0, 4).toString('ascii'), 'OggS');
});

test('WhatsappAttachmentService usa el endpoint de Evolution cuando la URL trae una imagen octet-stream no reconocible', async () => {
  const service = Object.create(WhatsappAttachmentService.prototype) as WhatsappAttachmentService;
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  Object.assign(service as object, {
    logger: { log: () => undefined, warn: () => undefined, error: () => undefined },
    evolutionApiClient: {
      downloadMediaUrl: async () => ({
        buffer: Buffer.alloc(4096, 0xab),
        contentType: 'application/octet-stream',
      }),
      downloadMediaMessage: async () => ({
        buffer: pngHeader,
        contentType: 'image/png',
      }),
    },
  });

  const resolveInboundDownload = (
    service as unknown as {
      resolveInboundDownload: (params: {
        config: Record<string, unknown>;
        fileType: string;
        mimeType?: string | null;
        sourceUrl?: string | null;
        messagePayload: Record<string, unknown>;
      }) => Promise<{ buffer: Buffer; contentType: string | null } | null>;
    }
  ).resolveInboundDownload.bind(service);

  const resolved = await resolveInboundDownload({
    config: {},
    fileType: 'image',
    mimeType: 'image/jpeg',
    sourceUrl: 'https://mmg.whatsapp.net/fake-image.enc',
    messagePayload: { imageMessage: { mimetype: 'image/jpeg' } },
  });

  assert.ok(resolved);
  assert.equal(resolved?.contentType, 'image/png');
  assert.deepEqual(resolved?.buffer, pngHeader);
});

test('WhatsappAttachmentService decodifica payload base64 antes de persistir media', async () => {
  const service = Object.create(WhatsappAttachmentService.prototype) as WhatsappAttachmentService;
  const prepareUploadPayload = (
    service as unknown as {
      prepareUploadPayload: (params: {
        buffer: Buffer;
        originalName: string;
        mimeType: string | null;
        fileType: string;
      }) => Promise<{
        buffer: Buffer;
        originalName: string;
        mimeType: string | null;
        durationSeconds: number | null;
      }>;
    }
  ).prepareUploadPayload.bind(service);

  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
  const payload = Buffer.from(`data:image/jpeg;base64,${jpegHeader.toString('base64')}`, 'utf8');
  const prepared = await prepareUploadPayload({
    buffer: payload,
    originalName: 'foto.jiff',
    mimeType: 'image/jpeg',
    fileType: 'image',
  });

  assert.equal(prepared.originalName, 'foto.jpg');
  assert.equal(prepared.mimeType, 'image/jpeg');
  assert.equal(prepared.durationSeconds, null);
  assert.deepEqual(prepared.buffer, jpegHeader);
});

test('EvolutionApiClientService decodifica texto base64 plano en descargas media', async () => {
  const service = Object.create(EvolutionApiClientService.prototype) as EvolutionApiClientService;
  const readMediaDownloadBody = (
    service as unknown as {
      readMediaDownloadBody: (
        response: Response,
        contentTypeHeader: string | null,
      ) => Promise<{ buffer: Buffer; contentType: string | null } | null>;
    }
  ).readMediaDownloadBody.bind(service);

  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const response = new Response(pngHeader.toString('base64'), {
    headers: { 'content-type': 'text/plain' },
  });

  const resolved = await readMediaDownloadBody(response, 'text/plain');
  assert.ok(resolved);
  assert.equal(resolved?.contentType, 'image/png');
  assert.deepEqual(resolved?.buffer, pngHeader);
});

test('EvolutionApiClientService prioriza un WebMessageInfo envuelto en message para getBase64FromMediaMessage', () => {
  const service = Object.create(EvolutionApiClientService.prototype) as EvolutionApiClientService;
  const buildDownloadMediaMessageCandidates = (
    service as unknown as {
      buildDownloadMediaMessageCandidates: (payload: Record<string, unknown>) => Array<Record<string, unknown>>;
    }
  ).buildDownloadMediaMessageCandidates.bind(service);

  const payload = {
    event: 'messages.upsert',
    data: {
      key: {
        remoteJid: '123@s.whatsapp.net',
        id: 'wamid-1',
        fromMe: false,
      },
      message: {
        audioMessage: {
          mimetype: 'audio/ogg; codecs=opus',
        },
      },
      messageType: 'audioMessage',
    },
  };

  const candidates = buildDownloadMediaMessageCandidates(payload);
  assert.ok(candidates.length >= 5);
  assert.deepEqual(candidates[0], {
    message: {
      key: payload.data.key,
      message: payload.data.message,
      messageType: payload.data.messageType,
    },
  });
  assert.deepEqual(candidates[1], payload);
  assert.deepEqual(candidates[2], payload.data);
  assert.deepEqual(candidates[3], {
    key: payload.data.key,
    message: payload.data.message,
  });
});

test('EvolutionService usa el payload exacto de Evolution al configurar webhooks', async () => {
  const service = Object.create(EvolutionService.prototype) as EvolutionService;
  const captured: {
    path?: string;
    init?: RequestInit;
    trace?: Record<string, unknown>;
  } = {};

  (
    service as unknown as {
      requestJsonWithTracing: (
        path: string,
        init: RequestInit,
        trace: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
    }
  ).requestJsonWithTracing = async (path, init, trace) => {
    captured.path = path;
    captured.init = init;
    captured.trace = trace;
    return { ok: true };
  };

  await service.setWebhook({
    instanceName: 'demo-instance',
    webhookUrl: 'https://app.example.com/webhook/evolution',
    events: ['messages.upsert', 'CONNECTION_UPDATE'],
  });

  assert.equal(captured.path, '/webhook/set/demo-instance');
  assert.ok(captured.init?.body);
  assert.deepEqual(JSON.parse(String(captured.init?.body)), {
    enabled: true,
    url: 'https://app.example.com/webhook/evolution',
    webhook_by_events: true,
    webhook_base64: false,
    events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
  });
});

test('EvolutionService reaplica webhook con wrapper compat cuando Evolution lo exige', async () => {
  const service = Object.create(EvolutionService.prototype) as EvolutionService;
  const calls: Array<{ path: string; init: RequestInit; trace: Record<string, unknown> }> = [];

  (
    service as unknown as {
      requestJsonWithTracing: (
        path: string,
        init: RequestInit,
        trace: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
    }
  ).requestJsonWithTracing = async (path, init, trace) => {
    calls.push({ path, init, trace });
    if (calls.length === 1) {
      throw new Error('Evolution API error (400): Bad Request | instance requires property "webhook"');
    }

    return { ok: true };
  };

  (
    service as unknown as {
      logger: { warn: (message: string) => void };
    }
  ).logger = { warn: () => undefined };

  await service.setWebhook({
    instanceName: 'demo-instance',
    webhookUrl: 'https://app.example.com/webhook/evolution',
    events: ['messages.upsert', 'CONNECTION_UPDATE'],
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(String(calls[1].init.body)), {
    webhook: {
      enabled: true,
      url: 'https://app.example.com/webhook/evolution',
      webhookByEvents: true,
      webhookBase64: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    },
  });
});

test('EvolutionService usa connectionState como endpoint principal al consultar estado de instancia', async () => {
  const service = Object.create(EvolutionService.prototype) as EvolutionService;
  const requestedPaths: string[] = [];

  (
    service as unknown as {
      requestJson: (path: string, init: RequestInit) => Promise<unknown>;
    }
  ).requestJson = async (path) => {
    requestedPaths.push(path);
    if (path.startsWith('/instance/connectionState/')) {
      return { instance: { state: 'open' } };
    }

    throw new Error(`unexpected path ${path}`);
  };

  const result = await service.getInstanceStatus('demo-instance');

  assert.equal(result.status, 'connected');
  assert.deepEqual(requestedPaths, ['/instance/connectionState/demo-instance']);
});

test('WhatsappChannelConfigService sincroniza el numero desde fetchInstances cuando connectionState no lo trae', async () => {
  const entity = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    evolutionServerUrl: 'https://evolution.example.com',
    evolutionApiKeyEncrypted: 'encrypted',
    instanceName: 'demo-instance',
    webhookEnabled: true,
    webhookUrl: null,
    webhookByEvents: true,
    webhookBase64: false,
    webhookEventsJson: [],
    isActive: true,
    instancePhone: null,
    instanceStatus: 'disconnected',
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const repository = new InMemoryRepository([entity]);
  const service = new WhatsappChannelConfigService(
    repository as never,
    {
      getInstanceStatus: async () => ({ instance: { state: 'open' } }),
      getQr: async () => ({ qrcode: 'abc' }),
      fetchInstances: async () => ({
        instance: {
          instanceName: 'demo-instance',
          owner: '18295319445@s.whatsapp.net',
        },
      }),
    } as never,
    {
      decrypt: () => 'secret',
      encrypt: (value: string) => value,
      mask: (value: string) => value,
    } as never,
  );

  const result = await service.syncInstance('company-1');

  assert.equal(result['instancePhone'], '18295319445');
  const saved = await repository.findOne({ where: { companyId: 'company-1', provider: 'evolution' } });
  assert.equal(saved?.instancePhone, '18295319445');
  assert.equal(saved?.instanceStatus, 'connected');
});

test('WhatsappChannelConfigService sincroniza el numero cuando fetchInstances devuelve owner como objeto anidado', async () => {
  const entity = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    evolutionServerUrl: 'https://evolution.example.com',
    evolutionApiKeyEncrypted: 'encrypted',
    instanceName: 'demo-instance',
    webhookEnabled: true,
    webhookUrl: null,
    webhookByEvents: true,
    webhookBase64: false,
    webhookEventsJson: [],
    isActive: true,
    instancePhone: null,
    instanceStatus: 'disconnected',
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const repository = new InMemoryRepository([entity]);
  const service = new WhatsappChannelConfigService(
    repository as never,
    {
      getInstanceStatus: async () => ({ instance: { state: 'open' } }),
      getQr: async () => ({ qrcode: 'abc' }),
      fetchInstances: async () => ({
        data: [
          {
            instance: {
              instanceName: 'demo-instance',
              owner: {
                user: '18295319445',
                server: 's.whatsapp.net',
              },
            },
          },
        ],
      }),
    } as never,
    {
      decrypt: () => 'secret',
      encrypt: (value: string) => value,
      mask: (value: string) => value,
    } as never,
  );

  const result = await service.syncInstance('company-1');

  assert.equal(result['instancePhone'], '18295319445');
  const saved = await repository.findOne({ where: { companyId: 'company-1', provider: 'evolution' } });
  assert.equal(saved?.instancePhone, '18295319445');
});

test('WhatsappInstancesService lee respuestas anidadas de webhook.find devueltas por Evolution', () => {
  const service = Object.create(WhatsappInstancesService.prototype) as WhatsappInstancesService;
  const remote = {
    webhook: {
      webhook: {
        enabled: true,
        url: 'https://app.example.com/webhook/evolution',
        events: ['messages.upsert', 'connection.update'],
      },
    },
  };

  const url = (
    service as unknown as {
      readWebhookUrl: (value: Record<string, unknown>) => string;
    }
  ).readWebhookUrl(remote);
  const events = (
    service as unknown as {
      readWebhookEvents: (value: Record<string, unknown>) => string[];
    }
  ).readWebhookEvents(remote);

  assert.equal(url, 'https://app.example.com/webhook/evolution');
  assert.deepEqual(events, ['MESSAGES_UPSERT', 'CONNECTION_UPDATE']);
});

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

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async (entry: Record<string, unknown>) => { logs.push(entry); return entry; } },
    messagingService: {
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
    },
  });

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

test('WhatsappWebhookService separa dos usuarios por remoteJid, persiste mensajes correctos y registra logs REMOTE/USED iguales', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const chatsRepository = new InMemoryRepository<WhatsappChatEntity>([]);
  const messagesRepository = new InMemoryRepository<WhatsappMessageEntity>([]);
  const savedContactPhones: string[] = [];
  const createdConversations: Array<Record<string, string>> = [];
  const queuedJobs: Array<Record<string, unknown>> = [];
  const logLines: string[] = [];

  const messagingService = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    { getEntity: async () => config } as never,
    {} as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  const originalConsoleLog = console.log;
  console.log = (...args: unknown[]) => {
    logLines.push(args.map((arg) => String(arg)).join(' '));
  };

  try {
    const service = createWhatsappWebhookService({
      configsRepository,
      chatsRepository,
      configService: { getEntity: async () => config },
      logsService: { create: async () => ({}) },
      messagingService,
      contactsService: {
        findOrCreateByPhone: async (_companyId: string, phone: string) => {
          savedContactPhones.push(phone);
          return { id: `contact-${phone}` };
        },
      },
      conversationsService: {
        findOrCreateOpen: async (_companyId: string, _channelId: string, contactId: string) => {
          const conversation = { id: `conversation-${contactId}`, contactId };
          createdConversations.push(conversation);
          return conversation;
        },
      },
      messageProcessingQueue: {
        add: async (name: string, data: Record<string, unknown>) => {
          queuedJobs.push({ name, data });
        },
      },
      channelsService: {
        findOrCreateWhatsappBridge: async () => ({ id: 'channel-1', companyId: 'company-1' }),
      },
      appMessagesService: {
        findByMetadataValue: async () => null,
        create: async (_companyId: string, _conversationId: string, payload: Record<string, unknown>) => ({
          id: `app-message-${queuedJobs.length + 1}`,
          ...payload,
        }),
      },
    });

    const payloadUserA = {
      event: 'messages.upsert',
      instance: 'demo-instance',
      data: {
        messages: [
          {
            key: {
              remoteJid: '11111111111@s.whatsapp.net',
              id: 'wamid-user-a',
              fromMe: false,
            },
            pushName: 'User A',
            message: { conversation: 'Hola desde A' },
          },
        ],
      },
    };

    const payloadUserB = {
      event: 'messages.upsert',
      instance: 'demo-instance',
      data: {
        messages: [
          {
            key: {
              remoteJid: '12222222222@s.whatsapp.net',
              id: 'wamid-user-b',
              fromMe: false,
            },
            pushName: 'User B',
            message: { conversation: 'Hola desde B' },
          },
        ],
      },
    };

    const chatA = chatsRepository.create({
      id: 'chat-user-a',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '11111111111@s.whatsapp.net',
      originalRemoteJid: '11111111111@s.whatsapp.net',
      rawRemoteJid: '11111111111@s.whatsapp.net',
      canonicalRemoteJid: '11111111111@s.whatsapp.net',
      canonicalNumber: '1111111111',
      sendTarget: '1111111111',
      lastInboundJidType: 'pn',
      replyTargetUnresolved: false,
      autoReplyEnabled: true,
      pushName: 'User A',
      profileName: null,
      profilePictureUrl: null,
      lastMessageAt: null,
      unreadCount: 0,
    });
    const chatB = chatsRepository.create({
      id: 'chat-user-b',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '12222222222@s.whatsapp.net',
      originalRemoteJid: '12222222222@s.whatsapp.net',
      rawRemoteJid: '12222222222@s.whatsapp.net',
      canonicalRemoteJid: '12222222222@s.whatsapp.net',
      canonicalNumber: '2222222222',
      sendTarget: '2222222222',
      lastInboundJidType: 'pn',
      replyTargetUnresolved: false,
      autoReplyEnabled: true,
      pushName: 'User B',
      profileName: null,
      profilePictureUrl: null,
      lastMessageAt: null,
      unreadCount: 0,
    });
    await chatsRepository.save(chatA);
    await chatsRepository.save(chatB);

    await service.processNow('company-1', payloadUserA as never);
    await service.processNow('company-1', payloadUserB as never);

    const storedChatA = await chatsRepository.findOne({
      where: { companyId: 'company-1', remoteJid: '11111111111@s.whatsapp.net' },
    });
    const storedChatB = await chatsRepository.findOne({
      where: { companyId: 'company-1', remoteJid: '12222222222@s.whatsapp.net' },
    });
    const storedMessageA = await messagesRepository.findOne({
      where: { companyId: 'company-1', evolutionMessageId: 'wamid-user-a' },
    });
    const storedMessageB = await messagesRepository.findOne({
      where: { companyId: 'company-1', evolutionMessageId: 'wamid-user-b' },
    });

    assert.ok(storedChatA);
    assert.ok(storedChatB);
    assert.notEqual(storedChatA?.id, storedChatB?.id);
    assert.equal(storedChatA?.remoteJid, '11111111111@s.whatsapp.net');
    assert.equal(storedChatB?.remoteJid, '12222222222@s.whatsapp.net');
    assert.equal(storedMessageA?.remoteJid, '11111111111@s.whatsapp.net');
    assert.equal(storedMessageB?.remoteJid, '12222222222@s.whatsapp.net');

    assert.deepEqual(savedContactPhones, ['11111111111', '12222222222']);
    assert.equal(createdConversations.length, 2);
    assert.notEqual(createdConversations[0]['id'], createdConversations[1]['id']);
    assert.equal((queuedJobs[0]['data'] as Record<string, unknown>)['conversationId'], 'conversation-contact-11111111111');
    assert.equal((queuedJobs[1]['data'] as Record<string, unknown>)['conversationId'], 'conversation-contact-12222222222');

    const relevantLogs = logLines.filter((line) => line.startsWith('REMOTE:') || line.startsWith('USED:'));
    assert.deepEqual(relevantLogs, []);
  } finally {
    console.log = originalConsoleLog;
  }
});

test('WhatsappWebhookService ignora mensajes propios aunque lleguen con el numero de la instancia', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    instancePhone: '5511888888888',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const savedMessages: Array<Record<string, unknown>> = [];

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async (entry: Record<string, unknown>) => entry },
    messagingService: {
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
    },
  });

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
            fromMe: true,
          },
          sender: '5511999999999',
          pushName: 'Cliente Real',
          messageTimestamp: '1710000001',
          message: {
            conversation: 'Perfecto, me interesa',
          },
        },
      ],
    },
  };

  const result = await service.processNow('company-1', payload);

  assert.equal(result.savedMessages.length, 0);
  assert.equal(savedMessages.length, 0);
});

test('WhatsappWebhookService procesa message-receipt sin fromMe y normaliza ack numerico a delivered', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '5511999999999@s.whatsapp.net',
      originalRemoteJid: '5511999999999@s.whatsapp.net',
      rawRemoteJid: '5511999999999@s.whatsapp.net',
      canonicalRemoteJid: '5511999999999@s.whatsapp.net',
      canonicalNumber: '5511999999999',
      sendTarget: '5511999999999',
      lastInboundJidType: 'pn',
      replyTargetUnresolved: false,
      pushName: 'Cliente',
      profileName: null,
      profilePictureUrl: null,
      lastMessageAt: new Date(),
      unreadCount: 0,
    },
  ]);
  const messagesRepository = new InMemoryRepository([
    {
      id: 'message-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      chatId: 'chat-1',
      evolutionMessageId: 'wamid-status-webhook-1',
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: true,
      direction: 'outbound',
      messageType: 'text',
      textBody: 'Hola',
      caption: null,
      mimeType: null,
      mediaUrl: null,
      mediaStoragePath: null,
      mediaOriginalName: null,
      mediaSizeBytes: null,
      thumbnailUrl: null,
      rawPayloadJson: {},
      status: 'sent',
      sentAt: new Date('2026-03-20T04:00:00.000Z'),
      deliveredAt: null,
      readAt: null,
    },
  ]);

  const messagingService = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    { getEntity: async () => config } as never,
    {} as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async (entry: Record<string, unknown>) => entry },
    messagingService,
  });

  await service.processNow('company-1', {
    event: 'message-receipt',
    instance: 'demo-instance',
    data: {
      messageId: 'wamid-status-webhook-1',
      remoteJid: '5511999999999@s.whatsapp.net',
      ack: 2,
    },
  });

  const updated = await messagesRepository.findOne({
    where: { id: 'message-1', companyId: 'company-1' },
  });

  assert.equal(updated?.status, 'delivered');
  assert.ok(updated?.deliveredAt);
  assert.equal(updated?.readAt, null);
});

test('WhatsappWebhookService persiste imagen inbound en storage y actualiza thumbnail', async () => {
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
  const storedMediaUpdates: Array<Record<string, unknown>> = [];
  const attachmentDownloads: Array<Record<string, unknown>> = [];
  const realtimeMessages: Array<Record<string, unknown>> = [];

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async () => ({}) },
    messagingService: {
      upsertInboundMessage: async (params: Record<string, unknown>) => {
        savedMessages.push(params);
        return {
          id: 'message-image-1',
          chatId: 'chat-image-1',
          remoteJid: params['remoteJid'],
          messageType: params['messageType'],
          fromMe: params['fromMe'],
        };
      },
      updateStoredMedia: async (
        companyId: string,
        messageId: string,
        params: Record<string, unknown>,
      ) => {
        storedMediaUpdates.push({ companyId, messageId, ...params });
        return {
          id: messageId,
          chatId: 'chat-image-1',
          remoteJid: '5511999999999@s.whatsapp.net',
          messageType: 'image',
          fromMe: false,
          companyId,
          mediaStoragePath: params['mediaStoragePath'],
          thumbnailUrl: params['thumbnailUrl'],
        };
      },
    },
    botCenterRealtimeService: {
      ...botCenterRealtimeStub,
      publishMessageUpsert: async (message: Record<string, unknown>) => {
        realtimeMessages.push(message);
      },
    },
    attachmentsService: {
      downloadRemoteToStorage: async (params: Record<string, unknown>) => {
        attachmentDownloads.push(params);
        return {
          id: 'attachment-1',
          storagePath: 'company-1/chat/chat-image-1/message-image-1.jpg',
          sizeBytes: '2048',
          mimeType: 'image/jpeg',
          metadataJson: {
            thumbnailStoragePath:
                'company-1/chat/chat-image-1/message-image-1.jpg',
          },
        };
      },
    },
  });

  await service.processNow('company-1', {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      key: {
        remoteJid: '5511999999999@s.whatsapp.net',
        id: 'wamid-image-1',
        fromMe: false,
      },
      pushName: 'Marina',
      message: {
        imageMessage: {
          caption: 'Foto do produto',
          mimetype: 'image/jpeg',
          url: 'https://media.example.com/image.jpg',
          fileName: 'produto.jpg',
          jpegThumbnail: 'dGh1bWJuYWls',
        },
      },
    },
  });

  assert.equal(savedMessages[0]['messageType'], 'image');
  assert.equal(attachmentDownloads.length, 1);
  assert.equal(attachmentDownloads[0]['conversationId'], 'chat-image-1');
  assert.equal(storedMediaUpdates.length, 1);
  assert.equal(storedMediaUpdates[0]['mediaStoragePath'], 'company-1/chat/chat-image-1/message-image-1.jpg');
  assert.equal(storedMediaUpdates[0]['thumbnailUrl'], 'company-1/chat/chat-image-1/message-image-1.jpg');
  assert.equal(realtimeMessages.length, 1);
  assert.equal(realtimeMessages[0]['mediaStoragePath'], 'company-1/chat/chat-image-1/message-image-1.jpg');
});

test('WhatsappWebhookService procesa pttMessage como audio y persiste duracion almacenada', async () => {
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
  const storedMediaUpdates: Array<Record<string, unknown>> = [];
  const attachmentDownloads: Array<Record<string, unknown>> = [];
  const realtimeMessages: Array<Record<string, unknown>> = [];

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async () => ({}) },
    messagingService: {
      upsertInboundMessage: async (params: Record<string, unknown>) => {
        savedMessages.push(params);
        return {
          id: 'message-audio-1',
          chatId: 'chat-audio-1',
          remoteJid: params['remoteJid'],
          messageType: params['messageType'],
          fromMe: params['fromMe'],
        };
      },
      updateStoredMedia: async (
        companyId: string,
        messageId: string,
        params: Record<string, unknown>,
      ) => {
        storedMediaUpdates.push({ companyId, messageId, ...params });
        return {
          id: messageId,
          chatId: 'chat-audio-1',
          remoteJid: '5511999999999@s.whatsapp.net',
          messageType: 'audio',
          fromMe: false,
          companyId,
          mediaStoragePath: params['mediaStoragePath'],
          durationSeconds: params['durationSeconds'],
        };
      },
    },
    botCenterRealtimeService: {
      ...botCenterRealtimeStub,
      publishMessageUpsert: async (message: Record<string, unknown>) => {
        realtimeMessages.push(message);
      },
    },
    attachmentsService: {
      downloadRemoteToStorage: async (params: Record<string, unknown>) => {
        attachmentDownloads.push(params);
        return {
          id: 'attachment-audio-1',
          storagePath: 'company-1/chat/chat-audio-1/message-audio-1.mp3',
          sizeBytes: '4096',
          mimeType: 'audio/mpeg',
          metadataJson: {
            durationSeconds: 12,
          },
        };
      },
    },
  });

  await service.processNow('company-1', {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      key: {
        remoteJid: '5511999999999@s.whatsapp.net',
        id: 'wamid-audio-1',
        fromMe: false,
      },
      pushName: 'Marina',
      message: {
        pttMessage: {
          mimetype: 'audio/ogg; codecs=opus',
          seconds: 9,
        },
      },
    },
  });

  assert.equal(savedMessages[0]['messageType'], 'audio');
  assert.equal(savedMessages[0]['textBody'], 'Audio recibido');
  assert.equal(savedMessages[0]['durationSeconds'], 9);
  assert.equal(attachmentDownloads.length, 1);
  assert.equal(attachmentDownloads[0]['fileType'], 'audio');
  assert.equal(attachmentDownloads[0]['sourceUrl'], null);
  assert.equal(attachmentDownloads[0]['originalName'], 'audio-message-audio-1');
  assert.equal(storedMediaUpdates.length, 1);
  assert.equal(storedMediaUpdates[0]['mediaStoragePath'], 'company-1/chat/chat-audio-1/message-audio-1.mp3');
  assert.equal(storedMediaUpdates[0]['mimeType'], 'audio/mpeg');
  assert.equal(storedMediaUpdates[0]['durationSeconds'], 12);
  assert.equal(realtimeMessages.length, 1);
  assert.equal(realtimeMessages[0]['mediaStoragePath'], 'company-1/chat/chat-audio-1/message-audio-1.mp3');
  assert.equal(realtimeMessages[0]['durationSeconds'], 12);
});

test('WhatsappWebhookService no regresa de read a delivered cuando llegan updates duplicados', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '5511999999999@s.whatsapp.net',
      originalRemoteJid: '5511999999999@s.whatsapp.net',
      rawRemoteJid: '5511999999999@s.whatsapp.net',
      canonicalRemoteJid: '5511999999999@s.whatsapp.net',
      canonicalNumber: '5511999999999',
      sendTarget: '5511999999999',
      lastInboundJidType: 'pn',
      replyTargetUnresolved: false,
      pushName: 'Cliente',
      profileName: null,
      profilePictureUrl: null,
      lastMessageAt: new Date(),
      unreadCount: 0,
    },
  ]);
  const messagesRepository = new InMemoryRepository([
    {
      id: 'message-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      chatId: 'chat-1',
      evolutionMessageId: 'wamid-status-webhook-2',
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: true,
      direction: 'outbound',
      messageType: 'text',
      textBody: 'Hola',
      caption: null,
      mimeType: null,
      mediaUrl: null,
      mediaStoragePath: null,
      mediaOriginalName: null,
      mediaSizeBytes: null,
      thumbnailUrl: null,
      rawPayloadJson: {},
      status: 'read',
      sentAt: new Date('2026-03-20T04:00:00.000Z'),
      deliveredAt: new Date('2026-03-20T04:00:05.000Z'),
      readAt: new Date('2026-03-20T04:00:10.000Z'),
    },
  ]);

  const messagingService = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    { getEntity: async () => config } as never,
    {} as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async (entry: Record<string, unknown>) => entry },
    messagingService,
  });

  await service.processNow('company-1', {
    event: 'messages.update',
    instance: 'demo-instance',
    data: {
      key: {
        id: 'wamid-status-webhook-2',
      },
      status: 'delivered_ack',
    },
  });

  const updated = await messagesRepository.findOne({
    where: { id: 'message-1', companyId: 'company-1' },
  });

  assert.equal(updated?.status, 'read');
  assert.ok(updated?.readAt instanceof Date);
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
    instancePhone: null,
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
      checkConnection: async () => ({ status: 'connected', raw: { instance: { instanceName: 'demo-instance', state: 'open' } } }),
      getInstanceStatus: async () => ({ status: 'connected', raw: { instance: { instanceName: 'demo-instance', state: 'open' } } }),
      fetchInstances: async () => ([
        {
          instance: {
            instanceName: 'demo-instance',
            owner: '18295319445@s.whatsapp.net',
          },
        },
      ]),
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
  assert.equal(result['botCenterMessages'], 0);
  assert.equal(mirroredPayloads.length, 1);
  assert.equal(botCenterPayloads.length, 0);
  assert.equal(instance.phoneNumber, '18295319445');
  assert.equal(config.instancePhone, '18295319445');
  assert.equal(
    ((mirroredPayloads[0]['data'] as Record<string, unknown>)['messages'] as Array<unknown>).length,
    1,
  );
});

test('WhatsappInstancesService refresca y persiste el numero de la instancia desde fetchInstances de Evolution', async () => {
  const instance = {
    id: 'instance-1',
    tenantId: 'company-1',
    instanceName: 'demo-instance',
    status: 'connecting',
    qrCode: 'stub-qr',
    phoneNumber: null,
    jid: null,
    sessionData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instancePhone: null,
    instanceStatus: 'connecting',
    lastSyncAt: null,
  };

  const service = new WhatsappInstancesService(
    new InMemoryRepository([instance]) as never,
    { findOne: async () => ({ payload: { whatsapp: {} } }) } as never,
    new InMemoryRepository([config]) as never,
    new InMemoryRepository([]) as never,
    new InMemoryRepository([]) as never,
    new InMemoryRepository([]) as never,
    {
      checkConnection: async () => ({
        status: 'connected',
        raw: { instance: { instanceName: 'demo-instance', state: 'open' } },
      }),
      getInstanceStatus: async () => ({
        status: 'connected',
        raw: { instance: { instanceName: 'demo-instance', status: 'open' } },
      }),
      fetchInstances: async () => ([
        {
          instance: {
            instanceName: 'demo-instance',
            owner: '18295319445@s.whatsapp.net',
          },
        },
      ]),
    } as never,
    { get: () => undefined } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await service.refreshStatus('company-1', 'demo-instance');

  assert.equal(result.status, 'connected');
  assert.equal(result.phoneNumber, '18295319445');
  assert.equal(instance.phoneNumber, '18295319445');
  assert.equal(instance.jid, '18295319445@s.whatsapp.net');
  assert.equal(config.instancePhone, '18295319445');
});

test('WhatsappInstancesService extrae el numero cuando fetchInstances devuelve owner como objeto user/server', async () => {
  const instance = {
    id: 'instance-1',
    tenantId: 'company-1',
    instanceName: 'demo-instance',
    status: 'connecting',
    qrCode: 'stub-qr',
    phoneNumber: null,
    jid: null,
    sessionData: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instancePhone: null,
    instanceStatus: 'connecting',
    lastSyncAt: null,
  };

  const service = new WhatsappInstancesService(
    new InMemoryRepository([instance]) as never,
    { findOne: async () => ({ payload: { whatsapp: {} } }) } as never,
    new InMemoryRepository([config]) as never,
    new InMemoryRepository([]) as never,
    new InMemoryRepository([]) as never,
    new InMemoryRepository([]) as never,
    {
      checkConnection: async () => ({
        status: 'connected',
        raw: { instance: { instanceName: 'demo-instance', state: 'open' } },
      }),
      getInstanceStatus: async () => ({
        status: 'connected',
        raw: { instance: { instanceName: 'demo-instance', status: 'open' } },
      }),
      fetchInstances: async () => ({
        data: [
          {
            instance: {
              instanceName: 'demo-instance',
              owner: {
                user: '18295319445',
                server: 's.whatsapp.net',
              },
            },
          },
        ],
      }),
    } as never,
    { get: () => undefined } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await service.refreshStatus('company-1', 'demo-instance');

  assert.equal(result.status, 'connected');
  assert.equal(result.phoneNumber, '18295319445');
  assert.equal(instance.phoneNumber, '18295319445');
  assert.equal(instance.jid, '18295319445@s.whatsapp.net');
  assert.equal(config.instancePhone, '18295319445');
});

test('WhatsappWebhookService no procesa ni responde dos veces al mismo evolution message id', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const queuedJobs: Array<Record<string, unknown>> = [];
  const savedMessages: Array<Record<string, unknown>> = [];
  let existingLookupCount = 0;

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    messageProcessingQueue: {
      add: async (name: string, data: Record<string, unknown>, options: Record<string, unknown>) => {
        queuedJobs.push({ name, data, options });
      },
    },
    messagingService: {
      findByEvolutionMessageId: async (_companyId: string, evolutionMessageId: string | null) => {
        existingLookupCount += 1;
        if (existingLookupCount === 1) {
          return null;
        }

        return {
          id: 'wa-message-1',
          chatId: 'chat-1',
          evolutionMessageId,
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        };
      },
      upsertInboundMessage: async (params: Record<string, unknown>) => {
        savedMessages.push(params);
        return {
          id: 'wa-message-1',
          chatId: 'chat-1',
          remoteJid: params['remoteJid'],
          messageType: params['messageType'],
          fromMe: params['fromMe'],
        };
      },
      updateStoredMedia: async () => undefined,
    },
    chatsRepository: new InMemoryRepository([
      {
        id: 'chat-1',
        companyId: 'company-1',
        channelConfigId: 'config-1',
        remoteJid: '5511999999999@s.whatsapp.net',
        canonicalRemoteJid: '5511999999999@s.whatsapp.net',
        canonicalNumber: '5511999999999',
        sendTarget: '5511999999999',
        replyTargetUnresolved: false,
        autoReplyEnabled: true,
        pushName: 'Lucia',
        profileName: 'Lucia',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    appMessagesService: {
      findByMetadataValue: async () => null,
      create: async (_companyId: string, _conversationId: string, payload: Record<string, unknown>) => ({
        id: `app-message-${queuedJobs.length + 1}`,
        ...payload,
      }),
    },
  });

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      messages: [
        {
          key: {
            remoteJid: '5511999999999@s.whatsapp.net',
            id: 'wamid-duplicate-1',
            fromMe: false,
          },
          pushName: 'Lucia',
          message: { conversation: 'Hola una vez' },
        },
      ],
    },
  };

  await service.processNow('company-1', payload as never);
  await service.processNow('company-1', payload as never);

  assert.equal(savedMessages.length, 1);
  assert.equal(queuedJobs.length, 1);
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

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async () => ({}) },
    messagingService: {
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
    },
  });

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

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async () => ({}) },
    messagingService: {
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
    },
  });

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
    {
      getEntity: async () => ({ id: 'config-1', companyId: 'company-1', instanceName: 'demo-instance', instancePhone: null }),
      getEntityById: async () => ({ id: 'config-1', companyId: 'company-1', instanceName: 'demo-instance', instancePhone: null }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  const result = await service.diagnoseRecipientResolution('company-1', remoteJid);
  const updatedChat = await chatsRepository.findOne({ where: { id: 'chat-1', companyId: 'company-1' } });

  assert.equal(result.safeToSend, true);
  assert.equal(result.canonicalJid, '18295344286@s.whatsapp.net');
  assert.equal(result.canonicalNumber, '18295344286');
  assert.equal(result.finalSendTarget, '18295344286');
  assert.equal(result.chatRemoteJid, '234840490270800@lid');
  assert.equal(result.outboundRemoteJid, '18295344286@s.whatsapp.net');
  assert.equal(result.source, 'last_inbound_payload');
  assert.equal(updatedChat?.canonicalRemoteJid, '18295344286@s.whatsapp.net');
  assert.equal(updatedChat?.canonicalNumber, '18295344286');
  assert.equal(updatedChat?.sendTarget, null);
  assert.equal(updatedChat?.replyTargetUnresolved, false);
});

test('WhatsappWebhookService extrae canonicalRemoteJid desde estructuras anidadas en data.source sin usar el lid como telefono', async () => {
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

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async () => ({}) },
    messagingService: {
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
    },
  });

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      source: {
        sender: '+1 (829) 534-4286',
      },
      messages: [
        {
          key: {
            remoteJid: '234840490270800@lid',
            id: 'wamid-6',
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

test('WhatsappWebhookService descarta canonicalRemoteJid cuando coincide con el numero de la instancia y conserva el remoteJid original', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    instancePhone: '18295319442',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const savedMessages: Array<Record<string, unknown>> = [];

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async () => ({}) },
    messagingService: {
      upsertInboundMessage: async (params: Record<string, unknown>) => {
        savedMessages.push(params);
        return {
          id: 'message-instance-canonical',
          chatId: 'chat-instance-canonical',
          remoteJid: params['remoteJid'],
          messageType: params['messageType'],
          fromMe: params['fromMe'],
        };
      },
      updateStoredMedia: async () => undefined,
    },
  });

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      sender: '+1 (829) 531-9442',
      messages: [
        {
          key: {
            remoteJid: '234840490270800@lid',
            id: 'wamid-instance-canonical',
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
  assert.equal(savedMessages[0]['canonicalRemoteJid'], null);
});

test('WhatsappWebhookService resuelve canonicalRemoteJid via lookup de Evolution cuando el payload solo trae @lid', async () => {
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

  const service = createWhatsappWebhookService({
    configsRepository,
    configService: { getEntity: async () => config },
    logsService: { create: async () => ({}) },
    messagingService: {
      upsertInboundMessage: async (params: Record<string, unknown>) => {
        savedMessages.push(params);
        return {
          id: 'message-lookup',
          chatId: 'chat-lookup',
          remoteJid: params['remoteJid'],
          messageType: params['messageType'],
          fromMe: params['fromMe'],
        };
      },
      updateStoredMedia: async () => undefined,
    },
    evolutionApiClient: {
      findContacts: async () => ({
        data: [
          {
            id: '234840490270800@lid',
            jid: '18295344286@s.whatsapp.net',
            phone: '18295344286',
          },
        ],
      }),
      findChats: async () => ({}),
    },
    jidResolver: {
      ...jidResolverStub,
      lookupCanonicalRemoteJidFromEvolution: async () => '18295344286@s.whatsapp.net',
    },
  });

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      source: {},
      messages: [
        {
          key: {
            remoteJid: '234840490270800@lid',
            id: 'wamid-lookup',
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
  assert.equal(savedMessages[0]['canonicalRemoteJid'], '18295344286@s.whatsapp.net');
});

test('WhatsappWebhookService encola auto reply cuando el chat tiene modo agente activo', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '18295344286@s.whatsapp.net',
      canonicalRemoteJid: '18295344286@s.whatsapp.net',
      canonicalNumber: '18295344286',
      sendTarget: '18295344286',
      autoReplyEnabled: true,
      pushName: 'Cliente',
      profileName: 'Cliente',
      createdAt: new Date('2026-03-18T18:00:00.000Z'),
      updatedAt: new Date('2026-03-18T18:00:00.000Z'),
    },
  ]);
  const queuedJobs: Array<Record<string, unknown>> = [];
  const createdMessages: Array<Record<string, unknown>> = [];

  const service = createWhatsappWebhookService({
    configsRepository,
    chatsRepository,
    messageProcessingQueue: {
      add: async (name: string, data: Record<string, unknown>, options: Record<string, unknown>) => {
        queuedJobs.push({ name, data, options });
      },
    },
    messagingService: {
      upsertInboundMessage: async (params: Record<string, unknown>) => ({
        id: 'wa-message-1',
        chatId: 'chat-1',
        remoteJid: params['remoteJid'],
        messageType: params['messageType'],
        fromMe: params['fromMe'],
      }),
      updateStoredMedia: async () => undefined,
    },
    appMessagesService: {
      findByMetadataValue: async () => null,
      create: async (_companyId: string, _conversationId: string, payload: Record<string, unknown>) => {
        createdMessages.push(payload);
        return {
          id: 'app-message-1',
          ...payload,
        };
      },
    },
  });

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      messages: [
        {
          key: {
            remoteJid: '18295344286@s.whatsapp.net',
            id: 'wamid-auto-1',
            fromMe: false,
          },
          pushName: 'Cliente',
          message: { conversation: 'hola bot' },
        },
      ],
    },
  };

  await service.processNow('company-1', payload as never);

  assert.equal(createdMessages.length, 1);
  assert.equal(createdMessages[0]['content'], 'hola bot');
  assert.equal(queuedJobs.length, 1);
  assert.equal(queuedJobs[0]['name'], 'process-inbound-message');
  assert.equal((queuedJobs[0]['data'] as Record<string, unknown>)['companyId'], 'company-1');
  assert.equal((queuedJobs[0]['data'] as Record<string, unknown>)['conversationId'], 'conversation-1');
});

test('WhatsappWebhookService encola auto reply al numero del inbound actual aunque el chat tenga un sendTarget viejo', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '234840490270800@lid',
      canonicalRemoteJid: '15551230000@s.whatsapp.net',
      canonicalNumber: '15551230000',
      sendTarget: '15551230000',
      autoReplyEnabled: true,
      pushName: 'Cliente',
      profileName: 'Cliente',
      createdAt: new Date('2026-03-18T18:00:00.000Z'),
      updatedAt: new Date('2026-03-18T18:00:00.000Z'),
    },
  ]);
  const queuedJobs: Array<Record<string, unknown>> = [];

  const service = createWhatsappWebhookService({
    configsRepository,
    chatsRepository,
    messageProcessingQueue: {
      add: async (name: string, data: Record<string, unknown>, options: Record<string, unknown>) => {
        queuedJobs.push({ name, data, options });
      },
    },
    messagingService: {
      upsertInboundMessage: async (params: Record<string, unknown>) => ({
        id: 'wa-message-lid-1',
        chatId: 'chat-1',
        remoteJid: params['remoteJid'],
        messageType: params['messageType'],
        fromMe: params['fromMe'],
      }),
      updateStoredMedia: async () => undefined,
    },
    appMessagesService: {
      findByMetadataValue: async () => null,
      create: async (_companyId: string, _conversationId: string, payload: Record<string, unknown>) => ({
        id: 'app-message-lid-1',
        ...payload,
      }),
    },
  });

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      messages: [
        {
          key: {
            remoteJid: '234840490270800@lid',
            id: 'wamid-auto-current-sender',
            fromMe: false,
          },
          pushName: 'Cliente',
          source: {
            sender: '+1 (829) 534-4286',
          },
          message: { conversation: 'hola bot' },
        },
      ],
    },
  };

  await service.processNow('company-1', payload as never);

  assert.equal(queuedJobs.length, 1);
  assert.equal((queuedJobs[0]['data'] as Record<string, unknown>)['contactPhone'], '234840490270800');
  assert.equal((queuedJobs[0]['data'] as Record<string, unknown>)['remoteJid'], '234840490270800@lid');
});

test('WhatsappWebhookService crea o reutiliza bridge de canal cuando no existe uno exacto por instanceName', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '18295344286@s.whatsapp.net',
      canonicalRemoteJid: '18295344286@s.whatsapp.net',
      canonicalNumber: '18295344286',
      sendTarget: '18295344286',
      autoReplyEnabled: true,
      pushName: 'Cliente',
      profileName: 'Cliente',
      createdAt: new Date('2026-03-18T18:00:00.000Z'),
      updatedAt: new Date('2026-03-18T18:00:00.000Z'),
    },
  ]);
  const queuedJobs: Array<Record<string, unknown>> = [];

  const service = createWhatsappWebhookService({
    configsRepository,
    chatsRepository,
    channelsService: {
      getByInstanceNameUnsafe: async () => {
        throw new Error('Channel not found.');
      },
      findOrCreateWhatsappBridge: async () => ({
        id: 'channel-bridge-1',
        companyId: 'company-1',
      }),
    },
    messageProcessingQueue: {
      add: async (name: string, data: Record<string, unknown>, options: Record<string, unknown>) => {
        queuedJobs.push({ name, data, options });
      },
    },
    messagingService: {
      upsertInboundMessage: async (params: Record<string, unknown>) => ({
        id: 'wa-message-1',
        chatId: 'chat-1',
        remoteJid: params['remoteJid'],
        messageType: params['messageType'],
        fromMe: params['fromMe'],
      }),
      updateStoredMedia: async () => undefined,
    },
    appMessagesService: {
      findByMetadataValue: async () => null,
      create: async (_companyId: string, _conversationId: string, payload: Record<string, unknown>) => ({
        id: 'app-message-1',
        ...payload,
      }),
    },
  });

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      messages: [
        {
          key: {
            remoteJid: '18295344286@s.whatsapp.net',
            id: 'wamid-auto-3',
            fromMe: false,
          },
          pushName: 'Cliente',
          message: { conversation: 'hola bot' },
        },
      ],
    },
  };

  await service.processNow('company-1', payload as never);

  assert.equal(queuedJobs.length, 1);
  assert.equal((queuedJobs[0]['data'] as Record<string, unknown>)['channelId'], 'channel-bridge-1');
});

test('WhatsappWebhookService no encola auto reply cuando el chat tiene modo agente apagado', async () => {
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    provider: 'evolution',
    instanceName: 'demo-instance',
    instanceStatus: 'connected',
    lastSyncAt: null,
  };
  const configsRepository = new InMemoryRepository([config]);
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '18295344286@s.whatsapp.net',
      canonicalRemoteJid: '18295344286@s.whatsapp.net',
      canonicalNumber: '18295344286',
      sendTarget: '18295344286',
      autoReplyEnabled: false,
      pushName: 'Cliente',
      profileName: 'Cliente',
      createdAt: new Date('2026-03-18T18:00:00.000Z'),
      updatedAt: new Date('2026-03-18T18:00:00.000Z'),
    },
  ]);
  const queuedJobs: Array<Record<string, unknown>> = [];
  const createdMessages: Array<Record<string, unknown>> = [];

  const service = createWhatsappWebhookService({
    configsRepository,
    chatsRepository,
    messageProcessingQueue: {
      add: async (name: string, data: Record<string, unknown>, options: Record<string, unknown>) => {
        queuedJobs.push({ name, data, options });
      },
    },
    messagingService: {
      upsertInboundMessage: async (params: Record<string, unknown>) => ({
        id: 'wa-message-1',
        chatId: 'chat-1',
        remoteJid: params['remoteJid'],
        messageType: params['messageType'],
        fromMe: params['fromMe'],
      }),
      updateStoredMedia: async () => undefined,
    },
    appMessagesService: {
      findByMetadataValue: async () => null,
      create: async (_companyId: string, _conversationId: string, payload: Record<string, unknown>) => {
        createdMessages.push(payload);
        return {
          id: 'app-message-1',
          ...payload,
        };
      },
    },
  });

  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      messages: [
        {
          key: {
            remoteJid: '18295344286@s.whatsapp.net',
            id: 'wamid-auto-2',
            fromMe: false,
          },
          pushName: 'Cliente',
          message: { conversation: 'hola bot' },
        },
      ],
    },
  };

  await service.processNow('company-1', payload as never);

  assert.equal(createdMessages.length, 0);
  assert.equal(queuedJobs.length, 0);
});

test('WhatsappMessagingService resuelve destinatario canonico desde last inbound payload con estructuras anidadas en data.source', async () => {
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
          key: { remoteJid, id: 'wamid-7', fromMe: false },
          source: {
              sender: '+1 (829) 534-4286',
          },
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
    {
      getEntity: async () => ({ id: 'config-1', companyId: 'company-1', instanceName: 'demo-instance', instancePhone: null }),
      getEntityById: async () => ({ id: 'config-1', companyId: 'company-1', instanceName: 'demo-instance', instancePhone: null }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  const result = await service.diagnoseRecipientResolution('company-1', remoteJid);
  const updatedChat = await chatsRepository.findOne({ where: { id: 'chat-1', companyId: 'company-1' } });

  assert.equal(result.safeToSend, true);
  assert.equal(result.canonicalJid, '18295344286@s.whatsapp.net');
  assert.equal(result.canonicalNumber, '18295344286');
  assert.equal(result.source, 'last_inbound_payload');
  assert.equal(updatedChat?.canonicalRemoteJid, '18295344286@s.whatsapp.net');
  assert.equal(updatedChat?.canonicalNumber, '18295344286');
  assert.equal(updatedChat?.sendTarget, null);
  assert.equal(updatedChat?.replyTargetUnresolved, false);
});

test('EvolutionWebhookService usa el remoteJid inbound para contacts.phone y el job AI cuando remoteJid es @lid', async () => {
  const capturedContactPhones: string[] = [];
  const queuedJobs: Array<Record<string, unknown>> = [];

  const service = new EvolutionWebhookService(
    {
      getByIdUnsafe: async () => ({
        id: 'channel-1',
        companyId: 'company-1',
        type: 'whatsapp',
        config: {},
      }),
    } as never,
    {
      findOrCreateByPhone: async (_companyId: string, phone: string) => {
        capturedContactPhones.push(phone);
        return { id: 'contact-1', phone };
      },
    } as never,
    {
      findOrCreateOpen: async () => ({ id: 'conversation-1', channelId: 'channel-1', contactId: 'contact-1' }),
    } as never,
    {
      findByMetadataValue: async () => null,
      create: async () => ({ id: 'message-1' }),
    } as never,
    { acquireIdempotency: async () => true, idempotencyKey: () => 'idem-key' } as never,
    { buildEventKey: () => 'event-key' } as never,
    jidResolverStub as never,
    { add: async (_name: string, payload: Record<string, unknown>) => { queuedJobs.push(payload); return undefined; } } as never,
    {
      findOne: async () => ({ payload: { whatsapp: { deduplicationEnabled: false, persistMediaMetadata: true } } }),
    } as never,
  );

  const result = await service.processIncomingMessage({
    channelId: 'channel-1',
    payload: {
      event: 'messages.upsert',
      instance: 'demo-instance',
      data: {
        key: {
          remoteJid: '234840490270800@lid',
          id: 'wamid-8',
        },
        pushName: 'Cliente',
        source: {
          sender: '+1 (829) 534-4286',
        },
        message: {
          conversation: 'hola',
        },
        messageTimestamp: '1710000001',
      },
    } as never,
  });

  assert.equal(result.normalizedMessage.senderId, '234840490270800');
  assert.equal(capturedContactPhones[0], '234840490270800');
  assert.equal(queuedJobs[0]['contactPhone'], '234840490270800');
  assert.equal(queuedJobs[0]['remoteJid'], '234840490270800@lid');
});

test('WhatsappJidResolverService extrae canonicalRemoteJid desde payload.sender en raiz', () => {
  const resolver = new WhatsappJidResolverService(emptyEvolutionApiClient as never);

  const canonical = resolver.extractCanonicalRemoteJidFromPayload({
    event: 'messages.upsert',
    instance: 'demo-instance',
    sender: '18295344286@s.whatsapp.net',
    data: {
      key: {
        remoteJid: '234840490270800@lid',
        id: 'wamid-root-sender',
        fromMe: false,
      },
      source: 'android',
      message: {
        conversation: 'hola',
      },
    },
  });

  assert.equal(canonical, '18295344286@s.whatsapp.net');
});

test('BotCenterService prioriza numeros limpios sobre JIDs al resolver contacts.phone', () => {
  const service = new BotCenterService(
    { get: () => null } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const fromSendTarget = (service as any).resolveConversationContactPhone({
    remoteJid: '234840490270800@lid',
    canonicalRemoteJid: '18295344286@s.whatsapp.net',
    canonicalNumber: '18295344286',
    sendTarget: '18295344286',
  });
  const fromCanonicalJid = (service as any).resolveConversationContactPhone({
    remoteJid: '18295344286@s.whatsapp.net',
    canonicalRemoteJid: '18295344286@s.whatsapp.net',
    canonicalNumber: null,
    sendTarget: null,
  });

  assert.equal(fromSendTarget, '234840490270800');
  assert.equal(fromCanonicalJid, '18295344286');
});

test('WhatsappMessagingService bloquea envio cuando chat.remoteJid apunta al numero de la instancia', async () => {
  const capturedPayloads: Array<Record<string, unknown>> = [];
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    instanceName: 'demo-instance',
    instancePhone: '18295319442',
  };
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '18295319442@s.whatsapp.net',
      originalRemoteJid: '18295319442@s.whatsapp.net',
      rawRemoteJid: '18295319442@s.whatsapp.net',
      canonicalRemoteJid: '18295319442@s.whatsapp.net',
      canonicalNumber: '18295319442',
      sendTarget: '18295319442',
      createdAt: new Date('2026-03-18T18:00:00.000Z'),
      updatedAt: new Date('2026-03-18T18:00:00.000Z'),
    },
  ]);
  const messagesRepository = new InMemoryRepository([]);

  const service = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    {
      getEntity: async () => config,
      getEntityById: async () => config,
    } as never,
    {
      sendText: async (_config: unknown, body: Record<string, unknown>) => {
        capturedPayloads.push(body);
        return { key: { id: 'wamid-outbound-1' }, status: 'sent' };
      },
    } as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  await assert.rejects(
    service.sendText('company-1', {
      channelConfigId: 'config-1',
      remoteJid: '18295319442@s.whatsapp.net',
      text: 'hola',
    }),
    /coincide con la instancia|coincide con el numero de la instancia/,
  );
  assert.equal(capturedPayloads.length, 0);
});

test('WhatsappMessagingService no envia a un chat @lid si el unico canonical guardado coincide con la instancia', async () => {
  const capturedPayloads: Array<Record<string, unknown>> = [];
  const config = {
    id: 'config-1',
    companyId: 'company-1',
    instanceName: 'demo-instance',
    instancePhone: '18295319442',
  };
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '234840490270800@lid',
      originalRemoteJid: '234840490270800@lid',
      rawRemoteJid: '234840490270800@lid',
      canonicalRemoteJid: '18295319442@s.whatsapp.net',
      canonicalNumber: '18295319442',
      sendTarget: '18295319442',
      createdAt: new Date('2026-03-18T18:00:00.000Z'),
      updatedAt: new Date('2026-03-18T18:00:00.000Z'),
    },
  ]);
  const messagesRepository = new InMemoryRepository([]);

  const service = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    {
      getEntity: async () => config,
      getEntityById: async () => config,
    } as never,
    {
      sendText: async (_config: unknown, body: Record<string, unknown>) => {
        capturedPayloads.push(body);
        return { key: { id: 'wamid-outbound-1' }, status: 'sent' };
      },
    } as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  await assert.rejects(
    service.sendText('company-1', {
      channelConfigId: 'config-1',
      remoteJid: '234840490270800@lid',
      text: 'hola',
    }),
    /No se pudo resolver un destinatario WhatsApp válido para este chat @lid/,
  );

  assert.equal(capturedPayloads.length, 0);
});

test('WhatsappMessagingService usa el canonical telefonico real para responder un chat @lid', async () => {
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '234840490270800@lid',
      originalRemoteJid: '234840490270800@lid',
      rawRemoteJid: '234840490270800@lid',
      canonicalRemoteJid: '18295344286@s.whatsapp.net',
      canonicalNumber: '18295344286',
      sendTarget: '18295344286',
      createdAt: new Date('2026-03-18T18:00:00.000Z'),
      updatedAt: new Date('2026-03-18T18:00:00.000Z'),
    },
  ]);
  const messagesRepository = new InMemoryRepository([]);

  const service = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    {
      getEntity: async () => ({ id: 'config-1', companyId: 'company-1', instanceName: 'demo-instance', instancePhone: '9999999999' }),
      getEntityById: async () => ({ id: 'config-1', companyId: 'company-1', instanceName: 'demo-instance', instancePhone: '9999999999' }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  const result = await service.diagnoseRecipientResolution('company-1', '234840490270800@lid');

  assert.equal(result.chatRemoteJid, '234840490270800@lid');
  assert.equal(result.outboundRemoteJid, '18295344286@s.whatsapp.net');
  assert.equal(result.finalSendTarget, '18295344286');
});

test('EvolutionWebhookService ignora mensajes fromMe para prevenir self loop', async () => {
  const queuedJobs: Array<Record<string, unknown>> = [];

  const service = new EvolutionWebhookService(
    {
      getByIdUnsafe: async () => ({
        id: 'channel-1',
        companyId: 'company-1',
        type: 'whatsapp',
        config: {},
      }),
    } as never,
    {
      findOrCreateByPhone: async () => ({ id: 'contact-1', phone: '234840490270800' }),
    } as never,
    {
      findOrCreateOpen: async () => ({ id: 'conversation-1', channelId: 'channel-1', contactId: 'contact-1' }),
    } as never,
    {
      findByMetadataValue: async () => null,
      create: async () => ({ id: 'message-1' }),
    } as never,
    { acquireIdempotency: async () => true, idempotencyKey: () => 'idem-key' } as never,
    { buildEventKey: () => 'event-key' } as never,
    jidResolverStub as never,
    { add: async (_name: string, payload: Record<string, unknown>) => { queuedJobs.push(payload); return undefined; } } as never,
    {
      findOne: async () => ({ payload: { whatsapp: { deduplicationEnabled: false, persistMediaMetadata: true } } }),
    } as never,
  );

  const result = await service.processIncomingMessage({
    channelId: 'channel-1',
    payload: {
      event: 'messages.upsert',
      instance: 'demo-instance',
      data: {
        key: {
          remoteJid: '234840490270800@lid',
          id: 'wamid-fromme-1',
          fromMe: true,
        },
        message: {
          conversation: 'hola',
        },
        messageTimestamp: '1710000001',
      },
    } as never,
  });

  assert.equal(result.orchestration.queued, false);
  assert.equal(queuedJobs.length, 0);
});

test('BotCenterService resuelve canal por fallback cuando no existe bridge exacto por instanceName', async () => {
  const service = new BotCenterService(
    { get: () => null } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      getByInstanceNameUnsafe: async () => {
        throw new Error('channel not found');
      },
      list: async () => ([
        {
          id: 'channel-1',
          companyId: 'company-1',
          type: 'whatsapp',
          config: { instanceName: 'demo-instance' },
        },
      ]),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {
      findOne: async () => ({
        id: 'config-1',
        companyId: 'company-1',
        instanceName: 'demo-instance',
      }),
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const channel = await (service as any).resolveCanonicalChannel('company-1', {
    channelConfigId: 'config-1',
  });

  assert.deepEqual(channel, { id: 'channel-1' });
});

test('WhatsappMessagingService normaliza delivered para mensajes salientes y marca deliveredAt', async () => {
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '5511999999999@s.whatsapp.net',
      originalRemoteJid: '5511999999999@s.whatsapp.net',
      rawRemoteJid: '5511999999999@s.whatsapp.net',
      canonicalRemoteJid: '5511999999999@s.whatsapp.net',
      canonicalNumber: '5511999999999',
      sendTarget: '5511999999999',
      lastInboundJidType: 'pn',
      replyTargetUnresolved: false,
      pushName: 'Cliente',
      profileName: null,
      profilePictureUrl: null,
      lastMessageAt: new Date(),
      unreadCount: 0,
    },
  ]);
  const messagesRepository = new InMemoryRepository([
    {
      id: 'message-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      chatId: 'chat-1',
      evolutionMessageId: 'wamid-status-1',
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: true,
      direction: 'outbound',
      messageType: 'text',
      textBody: 'Hola',
      caption: null,
      mimeType: null,
      mediaUrl: null,
      mediaStoragePath: null,
      mediaOriginalName: null,
      mediaSizeBytes: null,
      thumbnailUrl: null,
      rawPayloadJson: {},
      status: 'sent',
      sentAt: new Date('2026-03-20T04:00:00.000Z'),
      deliveredAt: null,
      readAt: null,
    },
  ]);

  const service = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    { getEntity: async () => ({ id: 'config-1', companyId: 'company-1' }) } as never,
    {} as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  const message = await service.upsertInboundMessage({
    companyId: 'company-1',
    config: { id: 'config-1', companyId: 'company-1' } as never,
    remoteJid: '5511999999999@s.whatsapp.net',
    evolutionMessageId: 'wamid-status-1',
    fromMe: true,
    messageType: 'unknown',
    textBody: null,
    caption: null,
    mimeType: null,
    mediaUrl: null,
    mediaOriginalName: null,
    thumbnailUrl: null,
    durationSeconds: null,
    rawPayloadJson: { status: 'delivered' },
    status: 'delivered_ack',
  });

  assert.equal(message.status, 'delivered');
  assert.ok(message.deliveredAt instanceof Date);
  assert.equal(message.readAt, null);
});

test('WhatsappMessagingService normaliza read para mensajes salientes y marca readAt', async () => {
  const chatsRepository = new InMemoryRepository([
    {
      id: 'chat-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      remoteJid: '5511999999999@s.whatsapp.net',
      originalRemoteJid: '5511999999999@s.whatsapp.net',
      rawRemoteJid: '5511999999999@s.whatsapp.net',
      canonicalRemoteJid: '5511999999999@s.whatsapp.net',
      canonicalNumber: '5511999999999',
      sendTarget: '5511999999999',
      lastInboundJidType: 'pn',
      replyTargetUnresolved: false,
      pushName: 'Cliente',
      profileName: null,
      profilePictureUrl: null,
      lastMessageAt: new Date(),
      unreadCount: 0,
    },
  ]);
  const messagesRepository = new InMemoryRepository([
    {
      id: 'message-1',
      companyId: 'company-1',
      channelConfigId: 'config-1',
      chatId: 'chat-1',
      evolutionMessageId: 'wamid-status-2',
      remoteJid: '5511999999999@s.whatsapp.net',
      fromMe: true,
      direction: 'outbound',
      messageType: 'text',
      textBody: 'Hola',
      caption: null,
      mimeType: null,
      mediaUrl: null,
      mediaStoragePath: null,
      mediaOriginalName: null,
      mediaSizeBytes: null,
      thumbnailUrl: null,
      rawPayloadJson: {},
      status: 'sent',
      sentAt: new Date('2026-03-20T04:00:00.000Z'),
      deliveredAt: null,
      readAt: null,
    },
  ]);

  const service = new WhatsappMessagingService(
    chatsRepository as never,
    messagesRepository as never,
    { getEntity: async () => ({ id: 'config-1', companyId: 'company-1' }) } as never,
    {} as never,
    {} as never,
    {} as never,
    jidResolverStub as never,
  );

  const message = await service.upsertInboundMessage({
    companyId: 'company-1',
    config: { id: 'config-1', companyId: 'company-1' } as never,
    remoteJid: '5511999999999@s.whatsapp.net',
    evolutionMessageId: 'wamid-status-2',
    fromMe: true,
    messageType: 'unknown',
    textBody: null,
    caption: null,
    mimeType: null,
    mediaUrl: null,
    mediaOriginalName: null,
    thumbnailUrl: null,
    durationSeconds: null,
    rawPayloadJson: { status: 'read' },
    status: 'READ_ACK',
  });

  assert.equal(message.status, 'read');
  assert.ok(message.deliveredAt instanceof Date);
  assert.ok(message.readAt instanceof Date);
});
