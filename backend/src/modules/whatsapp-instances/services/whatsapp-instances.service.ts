import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BotConfigurationEntity } from '../../bot-configuration/entities/bot-configuration.entity';
import { ChannelsService } from '../../channels/channels.service';
import { EVOLUTION_INSTANCE_WEBHOOK_EVENTS, EvolutionService } from '../../evolution/evolution.service';
import { EvolutionWebhookService } from '../../evolution-webhook/services/evolution-webhook.service';
import { WhatsappChannelConfigEntity } from '../../whatsapp-channel/entities/whatsapp-channel-config.entity';
import { WhatsappChannelLogEntity } from '../../whatsapp-channel/entities/whatsapp-channel-log.entity';
import { WhatsappChatEntity } from '../../whatsapp-channel/entities/whatsapp-chat.entity';
import { WhatsappMessageEntity } from '../../whatsapp-channel/entities/whatsapp-message.entity';
import { WhatsappChannelConfigService } from '../../whatsapp-channel/services/whatsapp-channel-config.service';
import {
  extractWhatsappIdentity,
  normalizeEvolutionWebhookEvent,
  normalizeComparableWebhookUrl,
  readEvolutionWebhookEvents,
  readEvolutionWebhookUrl,
} from '../../whatsapp-channel/services/whatsapp-normalization.util';
import { WhatsappWebhookService } from '../../whatsapp-channel/services/whatsapp-webhook.service';
import { WhatsappInstanceEntity, WhatsappInstanceStatus } from '../entities/whatsapp-instance.entity';

@Injectable()
export class WhatsappInstancesService {
  private readonly logger = new Logger(WhatsappInstancesService.name);
  private static readonly configurationScope = 'default';

  constructor(
    @InjectRepository(WhatsappInstanceEntity)
    private readonly repo: Repository<WhatsappInstanceEntity>,
    @InjectRepository(BotConfigurationEntity)
    private readonly botConfigurationRepository: Repository<BotConfigurationEntity>,
    @InjectRepository(WhatsappChannelConfigEntity)
    private readonly whatsappChannelConfigRepository: Repository<WhatsappChannelConfigEntity>,
    @InjectRepository(WhatsappChannelLogEntity)
    private readonly whatsappChannelLogRepository: Repository<WhatsappChannelLogEntity>,
    @InjectRepository(WhatsappChatEntity)
    private readonly whatsappChatRepository: Repository<WhatsappChatEntity>,
    @InjectRepository(WhatsappMessageEntity)
    private readonly whatsappMessageRepository: Repository<WhatsappMessageEntity>,
    private readonly evolutionService: EvolutionService,
    private readonly configService: ConfigService,
    private readonly channelsService: ChannelsService,
    private readonly evolutionWebhookService: EvolutionWebhookService,
    private readonly whatsappChannelConfigService: WhatsappChannelConfigService,
    private readonly whatsappWebhookService: WhatsappWebhookService,
  ) {}

  async list(tenantId: string) {
    const items = await this.repo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });

    // Never expose secrets
    return items.map((i) => this.toPublic(i));
  }

  async getByInstanceName(tenantId: string, instanceName: string): Promise<WhatsappInstanceEntity> {
    const normalized = this.normalizeInstanceName(instanceName);
    const found = await this.repo.findOne({ where: { tenantId, instanceName: normalized } });
    if (!found) throw new NotFoundException('WhatsApp instance not found.');
    return found;
  }

  async createInstance(tenantId: string, instanceName: string) {
    const normalized = this.normalizeInstanceName(instanceName);

    const existing = await this.repo.findOne({ where: { instanceName: normalized } });
    if (existing) {
      // global uniqueness avoids webhook ambiguity
      if (existing.tenantId === tenantId) {
        throw new ConflictException('Instance name already exists for this tenant.');
      }
      throw new ConflictException('Instance name already exists.');
    }

    await this.evolutionService.createInstance({ instanceName: normalized, qrcode: true });
    await this.tryConfigureWebhook(normalized);
    await this.ensureWhatsappChannelBridge(tenantId, normalized, 'created');

    const entity = this.repo.create({
      tenantId,
      instanceName: normalized,
      evolutionUrl: (this.configService.get<string>('EVOLUTION_API_URL') ?? '').trim() || null,
      evolutionApiKey: (this.configService.get<string>('EVOLUTION_API_KEY') ?? '').trim() || null,
      status: 'created',
      qrCode: null,
      phoneNumber: null,
      jid: null,
      sessionData: null,
    });

    const saved = await this.repo.save(entity);
    return this.toPublic(saved);
  }

  async getQRCode(tenantId: string, instanceName: string): Promise<{ qrCode: string | null }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    const raw = await this.evolutionService.getQRCode(entity.instanceName);
    const qrCode = this.extractQrCode(raw);

    entity.qrCode = qrCode;
    if (entity.status !== 'connected') {
      entity.status = 'connecting';
    }

    await this.repo.save(entity);
    return { qrCode };
  }

  async refreshStatus(tenantId: string, instanceName: string): Promise<{ status: WhatsappInstanceStatus; phoneNumber: string | null }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    const { status: evoStatus } = await this.evolutionService.checkConnection(entity.instanceName);
    const identity = await this.syncInstanceIdentityFromEvolution(entity, entity.instanceName);

    entity.status = this.mapEvolutionStatus(evoStatus);
    if (entity.status === 'connected') {
      entity.qrCode = null;
    }

    await this.repo.save(entity);
    return { status: entity.status, phoneNumber: identity.phoneNumber ?? entity.phoneNumber };
  }

  async logoutInstance(tenantId: string, instanceName: string): Promise<{ ok: true }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    await this.evolutionService.logoutInstance(entity.instanceName);

    entity.status = 'disconnected';
    entity.qrCode = null;
    entity.phoneNumber = null;
    entity.jid = null;
    entity.sessionData = null;

    await this.repo.save(entity);
    return { ok: true };
  }

  async updateInstance(
    tenantId: string,
    instanceName: string,
    newInstanceName: string,
  ) {
    const entity = await this.getByInstanceName(tenantId, instanceName);
    const currentName = entity.instanceName;
    const normalizedNewName = this.normalizeInstanceName(newInstanceName);

    if (currentName === normalizedNewName) {
      return this.toPublic(entity);
    }

    if (entity.status === 'connected') {
      throw new ConflictException(
        'No puedes editar el nombre de una instancia conectada. Desconéctala o elimínala primero.',
      );
    }

    const existing = await this.repo.findOne({ where: { instanceName: normalizedNewName } });
    if (existing) {
      if (existing.tenantId === tenantId) {
        throw new ConflictException('Instance name already exists for this tenant.');
      }
      throw new ConflictException('Instance name already exists.');
    }

    await this.evolutionService.createInstance({
      instanceName: normalizedNewName,
      qrcode: true,
    });
    await this.tryConfigureWebhook(normalizedNewName);
    await this.ensureWhatsappChannelBridge(tenantId, normalizedNewName, 'created');

    try {
      await this.evolutionService.deleteInstance(currentName);
    } catch (error) {
      try {
        await this.evolutionService.deleteInstance(normalizedNewName);
      } catch (rollbackError) {
        const rollbackMessage =
          rollbackError instanceof Error ? rollbackError.message : 'Unknown rollback error.';
        this.logger.error(`Failed to rollback replacement instance ${normalizedNewName}: ${rollbackMessage}`);
      }

      const message = error instanceof Error ? error.message : 'Unknown Evolution deletion error.';
      throw new ConflictException(
        `No se pudo reemplazar la instancia actual. ${message}`,
      );
    }

    entity.instanceName = normalizedNewName;
    entity.status = 'created';
    entity.qrCode = null;
    entity.phoneNumber = null;
    entity.jid = null;
    entity.sessionData = null;
    entity.evolutionUrl =
      (this.configService.get<string>('EVOLUTION_API_URL') ?? '').trim() ||
      entity.evolutionUrl;
    entity.evolutionApiKey =
      (this.configService.get<string>('EVOLUTION_API_KEY') ?? '').trim() ||
      entity.evolutionApiKey;

    const saved = await this.repo.save(entity);
    return this.toPublic(saved);
  }

  async deleteInstance(tenantId: string, instanceName: string): Promise<{ ok: true }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    await this.evolutionService.deleteInstance(entity.instanceName);
    await this.repo.remove(entity);

    return { ok: true };
  }

  async configureWebhook(tenantId: string, instanceName: string): Promise<{ ok: true; webhookUrl: string; events: string[] }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);
    const webhookUrl = this.evolutionService.buildInstanceWebhookUrl();
    const webhookEvents = await this.getConfiguredWebhookEvents();

    await this.evolutionService.setWebhook({
      instanceName: entity.instanceName,
      webhookUrl,
      events: webhookEvents,
    });

    return { ok: true, webhookUrl, events: webhookEvents };
  }

  async reapplyWebhook(tenantId: string, instanceName: string): Promise<{ ok: true; webhookUrl: string; events: string[]; response: unknown }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);
    const result = await this.evolutionService.reapplyWebhook(entity.instanceName);

    return {
      ok: true,
      webhookUrl: result.webhookUrl,
      events: result.events,
      response: result.remote,
    };
  }

  async getWebhookStatus(
    tenantId: string,
    instanceName: string,
  ): Promise<{
    instanceName: string;
    expectedWebhookUrl: string;
    expectedEvents: string[];
    remoteWebhookUrl: string;
    remoteEvents: string[];
    isConfigured: boolean;
    matchesExpected: boolean;
    autoConfigured: boolean;
    remote: Record<string, unknown> | null;
    error: string | null;
  }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);
    const expectedWebhookUrl = this.evolutionService.buildInstanceWebhookUrl();
    const expectedEvents = await this.getConfiguredWebhookEvents();

    try {
      const currentStatus = await this.readWebhookStatus(
        entity.instanceName,
        expectedWebhookUrl,
        expectedEvents,
      );

      if (currentStatus.matchesExpected) {
        return {
          ...currentStatus,
          autoConfigured: false,
          error: null,
        };
      }

      await this.evolutionService.setWebhook({
        instanceName: entity.instanceName,
        webhookUrl: expectedWebhookUrl,
        events: expectedEvents,
      });

      const repairedStatus = await this.readWebhookStatus(
        entity.instanceName,
        expectedWebhookUrl,
        expectedEvents,
      );

      return {
        ...repairedStatus,
        autoConfigured: repairedStatus.matchesExpected,
        error: repairedStatus.matchesExpected
            ? null
            : 'No se pudo dejar el webhook sincronizado en Evolution.',
      };
    } catch (error) {
      return {
        instanceName: entity.instanceName,
        expectedWebhookUrl,
        expectedEvents,
        remoteWebhookUrl: '',
        remoteEvents: [],
        isConfigured: false,
        matchesExpected: false,
        autoConfigured: false,
        remote: null,
        error: error instanceof Error ? error.message : 'No se pudo consultar el webhook en Evolution.',
      };
    }
  }

  async getInstanceHealth(
    tenantId: string,
    instanceName: string,
  ): Promise<{
    instanceName: string;
    connected: boolean;
    webhookConfigured: boolean;
    lastWebhookEventAt: string | null;
    lastWebhookEvent: string | null;
    lastInboundMessageAt: string | null;
    lastInboundMessage: string | null;
    lastError: string | null;
    activityBadge: 'healthy' | 'quiet' | 'inactive' | 'issue';
    activityLabel: string;
    channelReady: boolean;
  }> {
    try {
      await this.refreshStatus(tenantId, instanceName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_refresh_error';
      this.logger.warn(
        `[EVOLUTION INSTANCE HEALTH] refresh skipped instance=${instanceName} reason=${message}`,
      );
    }

    const entity = await this.getByInstanceName(tenantId, instanceName);
    await this.ensureWhatsappChannelBridge(entity.tenantId, entity.instanceName, entity.status);

    const [webhookStatus, latestWebhookLog, latestInboundMessage, latestErrorLog] =
        await Promise.all([
          this.getWebhookStatus(tenantId, instanceName),
          this.whatsappChannelLogRepository.findOne({
            where: {
              companyId: tenantId,
              instanceName: entity.instanceName,
              direction: 'incoming_webhook',
            },
            order: { createdAt: 'DESC' },
          }),
          this.findLatestInboundMessage(tenantId, entity.instanceName),
          this.whatsappChannelLogRepository.findOne({
            where: {
              companyId: tenantId,
              instanceName: entity.instanceName,
              success: false,
            },
            order: { createdAt: 'DESC' },
          }),
        ]);

    const connected = entity.status === 'connected';
    const webhookConfigured = webhookStatus.matchesExpected;
    const lastWebhookEventAt = latestWebhookLog?.createdAt.toISOString() ?? null;
    const lastWebhookEvent = latestWebhookLog?.eventName ?? this.readSessionString(entity, 'lastInboundMessage', 'event');
    const lastInboundMessageAt = latestInboundMessage?.createdAt.toISOString() ?? this.readSessionString(entity, 'lastInboundMessage', 'receivedAt');
    const lastInboundMessage = this.readMessagePreview(latestInboundMessage) ?? this.readSessionString(entity, 'lastInboundMessage', 'inferredType');
    const lastError = latestErrorLog?.errorMessage?.trim() || null;
    const activity = this.computeActivityState({
      connected,
      webhookConfigured,
      lastInboundMessageAt,
      lastError,
    });

    return {
      instanceName: entity.instanceName,
      connected,
      webhookConfigured,
      lastWebhookEventAt,
      lastWebhookEvent,
      lastInboundMessageAt,
      lastInboundMessage,
      lastError,
      activityBadge: activity.badge,
      activityLabel: activity.label,
      channelReady: connected && webhookConfigured,
    };
  }

  async getInboundDebug(tenantId: string, instanceName: string): Promise<Record<string, unknown>> {
    const entity = await this.getByInstanceName(tenantId, instanceName);
    const config = await this.whatsappChannelConfigRepository.findOne({
      where: { companyId: tenantId, provider: 'evolution', instanceName: entity.instanceName },
    });

    const [latestInboundLog, latestErrorLog, latestMessage, latestChat] = await Promise.all([
      this.whatsappChannelLogRepository.findOne({
        where: { companyId: tenantId, instanceName: entity.instanceName, direction: 'incoming_webhook' },
        order: { createdAt: 'DESC' },
      }),
      this.whatsappChannelLogRepository.findOne({
        where: { companyId: tenantId, instanceName: entity.instanceName, success: false },
        order: { createdAt: 'DESC' },
      }),
      config
        ? this.whatsappMessageRepository.findOne({
            where: { companyId: tenantId, channelConfigId: config.id },
            order: { createdAt: 'DESC' },
          })
        : Promise.resolve(null),
      config
        ? this.whatsappChatRepository.findOne({
            where: { companyId: tenantId, channelConfigId: config.id },
            order: { lastMessageAt: 'DESC', createdAt: 'DESC' },
          })
        : Promise.resolve(null),
    ]);

    return {
      instanceName: entity.instanceName,
      companyId: tenantId,
      instanceStatus: entity.status,
      channelConfig: config
        ? {
            id: config.id,
            instanceName: config.instanceName,
            instanceStatus: config.instanceStatus,
            webhookUrl: config.webhookUrl,
            lastSyncAt: config.lastSyncAt?.toISOString() ?? null,
          }
        : null,
      latestInboundLog: latestInboundLog
        ? {
            id: latestInboundLog.id,
            createdAt: latestInboundLog.createdAt.toISOString(),
            eventName: latestInboundLog.eventName,
            endpointCalled: latestInboundLog.endpointCalled,
            success: latestInboundLog.success,
            errorMessage: latestInboundLog.errorMessage,
            requestPayloadJson: latestInboundLog.requestPayloadJson,
            responsePayloadJson: latestInboundLog.responsePayloadJson,
          }
        : null,
      latestErrorLog: latestErrorLog
        ? {
            id: latestErrorLog.id,
            createdAt: latestErrorLog.createdAt.toISOString(),
            eventName: latestErrorLog.eventName,
            errorMessage: latestErrorLog.errorMessage,
          }
        : null,
      latestChat: latestChat
        ? {
            id: latestChat.id,
            remoteJid: latestChat.remoteJid,
            pushName: latestChat.pushName,
            lastMessageAt: latestChat.lastMessageAt?.toISOString() ?? null,
            unreadCount: latestChat.unreadCount,
          }
        : null,
      latestMessage: latestMessage
        ? {
            id: latestMessage.id,
            chatId: latestMessage.chatId,
            remoteJid: latestMessage.remoteJid,
            messageType: latestMessage.messageType,
            fromMe: latestMessage.fromMe,
            status: latestMessage.status,
            textBody: latestMessage.textBody,
            caption: latestMessage.caption,
            createdAt: latestMessage.createdAt.toISOString(),
          }
        : null,
    };
  }

  async applyWebhook(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const data = this.readMap(payload['data']);
    const originalEvent = this.readString(payload['event']);
    const event = this.normalizeWebhookEventName(originalEvent);
    const instanceName = this.resolveWebhookInstanceName(payload, data);
    const trace = this.describeInboundPayload(payload);

    this.logger.log(
      `[EVOLUTION INBOUND] received ts=${new Date().toISOString()} event=${originalEvent || '(empty)'} instance=${instanceName || '(missing)'} remoteJid=${trace.remoteJid} messageId=${trace.messageId} type=${trace.messageType} body=${trace.bodyPreview}`,
    );
    this.logger.log(`[EVOLUTION INBOUND] payload accepted`);
    this.logger.log(`[EVOLUTION INBOUND] normalized event=${event || '(empty)'} accepted=${event.length > 0}`);

    if (!instanceName) {
      throw new BadRequestException('Missing instance in webhook payload.');
    }

    const entity = await this.repo.findOne({ where: { instanceName } });
    if (!entity) {
      this.logger.warn(`[EVOLUTION INBOUND] instance resolution failed instance=${instanceName} reason=unknown_instance`);
      return { updated: false, instanceName, ignored: true, reason: 'unknown_instance' };
    }

    await this.ensureWhatsappChannelBridge(entity.tenantId, entity.instanceName, entity.status);
    const config = await this.whatsappChannelConfigRepository.findOne({
      where: { companyId: entity.tenantId, provider: 'evolution' },
    });

    this.logger.log(
      `[EVOLUTION INBOUND] instance resolved instance=${entity.instanceName} companyId=${entity.tenantId}`,
    );
    this.logger.log(
      config
        ? `[EVOLUTION INBOUND] whatsapp config found id=${config.id} instance=${config.instanceName}`
        : `[EVOLUTION INBOUND] whatsapp config missing instance=${entity.instanceName}`,
    );

    try {
      await this.whatsappWebhookService.processNow(entity.tenantId, payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown WhatsApp channel webhook error.';
      this.logger.warn(`[EVOLUTION INBOUND] persistence failed instance=${instanceName} error=${message}`);
    }

    if (event === 'QRCODE_UPDATED') {
      const qrCode = this.extractQrCode(data);
      if (qrCode) {
        entity.qrCode = qrCode;
        if (entity.status !== 'connected') entity.status = 'connecting';
      }
      await this.repo.save(entity);
      return { updated: true, instanceName, event };
    }

    if (event === 'CONNECTION_UPDATE') {
      const next = this.guessStatusFromWebhook(data);
      const instanceIdentity = this.extractInstanceIdentity(data);
      const fallbackIdentity =
        instanceIdentity.phoneNumber || instanceIdentity.jid
          ? instanceIdentity
          : await this.syncInstanceIdentityFromEvolution(entity, entity.instanceName);
      entity.status = next ?? entity.status;
      entity.sessionData = data;
      if (fallbackIdentity.phoneNumber) {
        entity.phoneNumber = fallbackIdentity.phoneNumber;
      }
      if (fallbackIdentity.jid) {
        entity.jid = fallbackIdentity.jid;
      }

      if (entity.status === 'connected') {
        entity.qrCode = null;
      }

      await this.repo.save(entity);
      await this.syncChannelInstanceIdentity(
        entity.tenantId,
        entity.instanceName,
        fallbackIdentity.phoneNumber ?? entity.phoneNumber,
      );
      return { updated: true, instanceName, event };
    }

    if (event === 'MESSAGES_UPSERT') {
      if (!entity.phoneNumber || !entity.jid) {
        const identity = await this.syncInstanceIdentityFromEvolution(
          entity,
          entity.instanceName,
        );
        if (identity.phoneNumber) {
          entity.phoneNumber = identity.phoneNumber;
        }
        if (identity.jid) {
          entity.jid = identity.jid;
        }
      }

      const expandedPayloads = this.expandInboundPayloads(payload);
      let mirroredMessages = 0;

      for (const entryPayload of expandedPayloads) {
        const entryData = this.readMap(entryPayload['data']);
        const key = this.readMap(entryData['key']);
        const remoteJid = this.normalizeRemoteJid(this.readString(key['remoteJid'])) || '(missing)';
        const messageId = this.readString(key['id']) || '(missing)';
        const normalizedMessageType = this.guessInboundMessageType(entryData);
        const bodyPreview = this.summarizeMessageBody(entryData);

        entity.sessionData = {
          ...(entity.sessionData ?? {}),
          lastInboundMessage: {
            receivedAt: new Date().toISOString(),
            event,
            inferredType: normalizedMessageType,
            bodyPreview,
            remoteJid,
            messageId,
            channelId: null,
          },
        };

        mirroredMessages += 1;
      }

      await this.repo.save(entity);

      this.logger.log(
        `[EVOLUTION INBOUND] processed event=${event} instance=${instanceName} companyId=${entity.tenantId} mirroredMessages=${mirroredMessages} botCenterMessages=0 channelId=(handled_by_whatsapp_channel)` ,
      );

      return {
        updated: true,
        instanceName,
        event,
        mirroredMessages,
        botCenterMessages: 0,
        channelId: null,
      };
    }

    if (event.includes('CALL')) {
      const whatsappSettings = await this.getWhatsappSettings();
      entity.sessionData = {
        ...(entity.sessionData ?? {}),
        lastCallEvent: {
          receivedAt: new Date().toISOString(),
          callHandlingMode: whatsappSettings.callHandlingMode,
          rejectedCallReply: whatsappSettings.rejectedCallReply,
          raw: data,
        },
      };
      await this.repo.save(entity);
      return { updated: true, instanceName, event };
    }

    this.logger.warn(`[EVOLUTION INBOUND] ignored event=${event || '(empty)'} instance=${instanceName} reason=unsupported_event`);
    return { updated: false, instanceName, ignored: true, reason: 'unsupported_event', event };
  }

  private normalizeInstanceName(value: string): string {
    const normalized = (value ?? '').trim().replace(/\s+/g, '_');
    if (!normalized) {
      throw new BadRequestException('instanceName is required.');
    }
    return normalized;
  }

  private mapEvolutionStatus(status: 'connecting' | 'connected' | 'disconnected'): WhatsappInstanceStatus {
    return status;
  }

  private extractQrCode(raw: unknown): string | null {
    const direct = this.tryReadQrValue(raw);
    if (direct) return direct;

    // If Evolution returned a nested shape, do shallow scan.
    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Record<string, unknown>;
      return (
        this.tryReadQrValue(r.qr) ||
        this.tryReadQrValue(r.qrcode) ||
        this.tryReadQrValue(r.qrCode) ||
        this.tryReadQrValue(r.base64) ||
        this.tryReadQrValue(r.data)
      );
    }

    return null;
  }

  private tryReadQrValue(value: unknown): string | null {
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return null;
      if (v.startsWith('data:image/')) return v;
      // Heuristic: many base64 PNG payloads are large
      if (v.length > 100 && /^[a-zA-Z0-9+/=\r\n]+$/.test(v)) return v;
      return v;
    }

    if (typeof value === 'object' && value !== null) {
      const r = value as Record<string, unknown>;
      const candidates = [r.qr, r.qrcode, r.qrCode, r.base64, r.image];
      const match = candidates.find((c) => typeof c === 'string' && (c as string).trim());
      return match ? (match as string).trim() : null;
    }

    return null;
  }

  private guessStatusFromWebhook(data: Record<string, unknown>): WhatsappInstanceStatus | null {
    const candidates: Array<unknown> = [data.status, data.state, data.connectionStatus, data.connection, data['connection_state']];
    const raw = candidates.find((c) => typeof c === 'string') as string | undefined;
    const s = (raw ?? '').toLowerCase();

    if (!s) return null;
    if (s.includes('connect') && !s.includes('disconnect')) return 'connected';
    if (s.includes('open')) return 'connected';
    if (s.includes('connecting') || s.includes('pair')) return 'connecting';
    if (s.includes('close') || s.includes('disconnect') || s.includes('offline')) return 'disconnected';

    return null;
  }

  private async tryConfigureWebhook(instanceName: string): Promise<void> {
    const whatsappSettings = await this.getWhatsappSettings();
    if (!whatsappSettings.autoApplyWebhook) {
      return;
    }

    try {
      const instanceWebhookUrl = this.evolutionService.buildInstanceWebhookUrl();
      const events = this.buildWebhookEvents();

      await this.evolutionService.setWebhook({
        instanceName,
        webhookUrl: instanceWebhookUrl,
        events,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Evolution webhook error.';
      this.logger.warn(`Failed to set Evolution instance webhook for ${instanceName}: ${message}`);
    }
  }

  private async getConfiguredWebhookEvents(): Promise<string[]> {
    await this.getWhatsappSettings();
    return this.buildWebhookEvents();
  }

  private buildWebhookEvents(): string[] {
    return [...EVOLUTION_INSTANCE_WEBHOOK_EVENTS];
  }

  private async readWebhookStatus(
    instanceName: string,
    expectedWebhookUrl: string,
    expectedEvents: string[],
  ): Promise<{
    instanceName: string;
    expectedWebhookUrl: string;
    expectedEvents: string[];
    remoteWebhookUrl: string;
    remoteEvents: string[];
    isConfigured: boolean;
    matchesExpected: boolean;
    remote: Record<string, unknown> | null;
  }> {
    const remote = await this.evolutionService.findWebhook(instanceName);
    const remoteWebhookUrl = this.readWebhookUrl(remote);
    const remoteEvents = this.readWebhookEvents(remote);
    const matchesExpectedUrl =
      normalizeComparableWebhookUrl(remoteWebhookUrl) ===
      normalizeComparableWebhookUrl(expectedWebhookUrl);
    const matchesExpectedEvents =
      remoteEvents.length > 0 &&
      expectedEvents.every((event) => remoteEvents.includes(this.normalizeWebhookEvent(event)));

    this.logger.log(
      `[EVOLUTION WEBHOOK STATUS] instanceName=${instanceName} expectedUrl=${expectedWebhookUrl} remoteUrl=${remoteWebhookUrl || '(empty)'} expectedEvents=${JSON.stringify(expectedEvents)} remoteEvents=${JSON.stringify(remoteEvents)} matchesExpectedUrl=${matchesExpectedUrl} matchesExpectedEvents=${matchesExpectedEvents}`,
    );

    return {
      instanceName,
      expectedWebhookUrl,
      expectedEvents,
      remoteWebhookUrl,
      remoteEvents,
      isConfigured: remoteWebhookUrl.length > 0,
      matchesExpected: matchesExpectedUrl && matchesExpectedEvents,
      remote,
    };
  }

  private async getWhatsappSettings(): Promise<{
    autoApplyWebhook: boolean;
    callHandlingMode: string;
    rejectedCallReply: string;
  }> {
    const snapshot = await this.botConfigurationRepository.findOne({
      where: { scope: WhatsappInstancesService.configurationScope },
    });

    const payload = snapshot?.payload as
      | { whatsapp?: Record<string, unknown> }
      | undefined;
    const whatsapp = payload?.whatsapp ?? {};

    return {
      autoApplyWebhook: this.readBoolean(whatsapp['autoApplyWebhook'], true),
      callHandlingMode: this.readString(whatsapp['callHandlingMode']) || 'notify',
      rejectedCallReply: this.readString(whatsapp['rejectedCallReply']),
    };
  }

  private async findChannelByInstanceName(companyId: string, instanceName: string) {
    try {
      return await this.channelsService.getByCompanyAndInstanceName(companyId, instanceName);
    } catch {
      return null;
    }
  }

  private guessInboundMessageType(data: Record<string, unknown>): string {
    const message = this.readMessageMap(data);

    if (message['audioMessage'] != null) return 'audio';
    if (message['imageMessage'] != null) return 'image';
    if (message['videoMessage'] != null) return 'video';
    if (message['documentMessage'] != null) return 'document';
    return 'text';
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readMap(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  }

  private readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private readWebhookUrl(source: Record<string, unknown>): string {
    return readEvolutionWebhookUrl(source);
  }

  private readWebhookEvents(source: Record<string, unknown>): string[] {
    return readEvolutionWebhookEvents(source).map((event) => this.normalizeWebhookEvent(event));
  }

  private normalizeWebhookEvent(event: string): string {
    return normalizeEvolutionWebhookEvent(event) ?? event.trim().toUpperCase();
  }

  private normalizeWebhookEventName(value?: string): string {
    const raw = (value ?? '').trim();
    if (!raw) {
      return '';
    }

    return normalizeEvolutionWebhookEvent(raw) ?? raw.replace(/\./g, '_').replace(/-/g, '_').toUpperCase();
  }

  private resolveWebhookInstanceName(
    payload: Record<string, unknown>,
    data: Record<string, unknown>,
  ): string {
    const direct = this.readString(payload['instance']) || this.readString(payload['instanceName']);
    if (direct) {
      return direct;
    }

    const firstMessage = this.readFirstMessageEntry(data);
    const nestedCandidates: Array<unknown> = [
      data['instance'],
      data['instanceName'],
      data['instance_name'],
      data['sender'],
      firstMessage['instance'],
      firstMessage['instanceName'],
      firstMessage['instance_name'],
    ];

    for (const candidate of nestedCandidates) {
      const resolved = this.readString(candidate);
      if (resolved) {
        return resolved;
      }
    }

    return '';
  }

  private extractPhoneNumber(data: Record<string, unknown>): string | null {
    return this.extractInstanceIdentity(data).phoneNumber;
  }

  private extractInstanceIdentity(data: Record<string, unknown>): {
    phoneNumber: string | null;
    jid: string | null;
  } {
    return extractWhatsappIdentity(data);
  }

  private extractInstanceIdentityFromRuntimePayload(
    value: unknown,
    instanceName: string,
    depth = 0,
  ): { phoneNumber: string | null; jid: string | null } {
    if (depth > 5 || value == null) {
      return { phoneNumber: null, jid: null };
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = this.extractInstanceIdentityFromRuntimePayload(
          item,
          instanceName,
          depth + 1,
        );
        if (nested.phoneNumber || nested.jid) {
          return nested;
        }
      }
      return { phoneNumber: null, jid: null };
    }

    const map = this.readMap(value);
    if (Object.keys(map).length === 0) {
      return { phoneNumber: null, jid: null };
    }

    const direct = this.extractInstanceIdentity(map);
    if (direct.phoneNumber || direct.jid) {
      return direct;
    }

    const nestedCandidates: Array<unknown> = [
      map['instance'],
      map['data'],
      map['response'],
      map['me'],
      map['instances'],
      map['result'],
      map['payload'],
    ];

    for (const candidate of nestedCandidates) {
      const nested = this.extractInstanceIdentityFromRuntimePayload(
        candidate,
        instanceName,
        depth + 1,
      );
      if (nested.phoneNumber || nested.jid) {
        return nested;
      }
    }

    for (const nestedValue of Object.values(map)) {
      if (!this.payloadMayContainInstanceIdentity(nestedValue, instanceName)) {
        continue;
      }

      const nested = this.extractInstanceIdentityFromRuntimePayload(
        nestedValue,
        instanceName,
        depth + 1,
      );
      if (nested.phoneNumber || nested.jid) {
        return nested;
      }
    }

    return { phoneNumber: null, jid: null };
  }

  private async syncInstanceIdentityFromEvolution(
    entity: WhatsappInstanceEntity,
    instanceName: string,
  ): Promise<{ phoneNumber: string | null; jid: string | null }> {
    const runtimePayloads: Array<{ source: string; payload: unknown }> = [];

    if (entity.sessionData) {
      runtimePayloads.push({ source: 'sessionData', payload: entity.sessionData });
    }

    const connectionState =
      typeof this.evolutionService.checkConnection === 'function'
        ? await this.evolutionService.checkConnection(instanceName).catch(() => null)
        : null;
    if (connectionState?.raw != null) {
      runtimePayloads.push({ source: 'connectionState', payload: connectionState.raw });
    }

    const status =
      typeof this.evolutionService.getInstanceStatus === 'function'
        ? await this.evolutionService.getInstanceStatus(instanceName).catch(() => null)
        : null;
    if (status?.raw != null) {
      runtimePayloads.push({ source: 'instanceStatus', payload: status.raw });
    }

    const fetchedInstances =
      typeof (this.evolutionService as { fetchInstances?: (name?: string) => Promise<unknown> }).fetchInstances ===
      'function'
        ? await (
            this.evolutionService as {
              fetchInstances: (name?: string) => Promise<unknown>;
            }
          )
            .fetchInstances(instanceName)
            .catch(() => null)
        : null;
    if (fetchedInstances != null) {
      runtimePayloads.push({
        source: 'fetchInstances',
        payload: this.selectMatchingInstancePayload(fetchedInstances, instanceName),
      });
    }

    let identity: { phoneNumber: string | null; jid: string | null } = {
      phoneNumber: null,
      jid: null,
    };
    for (const candidate of runtimePayloads) {
      identity = this.extractInstanceIdentityFromRuntimePayload(
        candidate.payload,
        instanceName,
      );
      if (identity.phoneNumber || identity.jid) {
        this.logger.log(
          `[EVOLUTION INSTANCE IDENTITY] instance=${instanceName} source=${candidate.source} phone=${identity.phoneNumber ?? '(none)'} jid=${identity.jid ?? '(none)'}`,
        );
        break;
      }
    }

    if (!identity.phoneNumber && !identity.jid) {
      this.logger.warn(
        `[EVOLUTION INSTANCE IDENTITY] instance=${instanceName} source=all phone=(none) jid=(none) payloads=${runtimePayloads
          .map((candidate) => `${candidate.source}:${this.describePayloadShape(candidate.payload)}`)
          .join(' | ')}`,
      );
    }

    if (identity.phoneNumber) {
      entity.phoneNumber = identity.phoneNumber;
    }
    if (identity.jid) {
      entity.jid = identity.jid;
    }

    await this.syncChannelInstanceIdentity(entity.tenantId, entity.instanceName, identity.phoneNumber ?? entity.phoneNumber);
    return identity;
  }

  private payloadMayContainInstanceIdentity(
    value: unknown,
    instanceName: string,
  ): boolean {
    if (typeof value === 'string') {
      return value.trim() === instanceName;
    }

    if (Array.isArray(value)) {
      return value.some((item) =>
        this.payloadMayContainInstanceIdentity(item, instanceName),
      );
    }

    if (typeof value !== 'object' || value == null) {
      return false;
    }

    const map = value as Record<string, unknown>;
    const candidateNames = [
      this.readString(map['instanceName']),
      this.readString(map['instance_name']),
      this.readString(map['name']),
      this.readString(this.readMap(map['instance'])['instanceName']),
      this.readString(this.readMap(map['instance'])['instance_name']),
      this.readString(this.readMap(map['instance'])['name']),
    ];

    return candidateNames.some((candidate) => candidate === instanceName);
  }

  private selectMatchingInstancePayload(value: unknown, instanceName: string): unknown {
    return this.findMatchingInstancePayload(value, instanceName) ?? value;
  }

  private findMatchingInstancePayload(value: unknown, instanceName: string): unknown | null {
    if (Array.isArray(value)) {
      for (const item of value) {
        const matched = this.findMatchingInstancePayload(item, instanceName);
        if (matched != null) {
          return matched;
        }
      }

      return null;
    }

    const map = this.readMap(value);
    if (Object.keys(map).length === 0) {
      return null;
    }

    const candidateNames = [
      this.readString(map['instanceName']),
      this.readString(map['instance_name']),
      this.readString(map['name']),
      this.readString(this.readMap(map['instance'])['instanceName']),
      this.readString(this.readMap(map['instance'])['instance_name']),
      this.readString(this.readMap(map['instance'])['name']),
    ].filter((candidate) => candidate.length > 0);

    if (candidateNames.includes(instanceName)) {
      return map;
    }

    for (const nested of [
      map['instance'],
      map['data'],
      map['response'],
      map['result'],
      map['payload'],
      map['instances'],
    ]) {
      const matched = this.findMatchingInstancePayload(nested, instanceName);
      if (matched != null) {
        return matched;
      }
    }

    return null;
  }

  private describePayloadShape(value: unknown, depth = 0): string {
    if (depth > 2 || value == null) {
      return '(none)';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return 'array(0)';
      }

      return `array(${value.length})[${this.describePayloadShape(value[0], depth + 1)}]`;
    }

    const map = this.readMap(value);
    const keys = Object.keys(map);
    if (keys.length === 0) {
      return typeof value;
    }

    const preview = keys.slice(0, 6).join(',');
    return `{${preview}${keys.length > 6 ? ',…' : ''}}`;
  }

  private async syncChannelInstanceIdentity(
    companyId: string,
    instanceName: string,
    phoneNumber: string | null,
  ): Promise<void> {
    const config = await this.whatsappChannelConfigRepository.findOne({
      where: { companyId, provider: 'evolution', instanceName },
    });
    if (!config) {
      return;
    }

    if (phoneNumber) {
      config.instancePhone = phoneNumber;
      config.lastSyncAt = new Date();
      await this.whatsappChannelConfigRepository.save(config);
    }
  }

  private readFirstMessageEntry(data: Record<string, unknown>): Record<string, unknown> {
    const messages = data['messages'];
    if (!Array.isArray(messages)) {
      return {};
    }

    const first = messages.find(
      (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
    );
    return first ?? {};
  }

  private readMessageMap(data: Record<string, unknown>): Record<string, unknown> {
    const direct = this.readMap(data['message']);
    if (Object.keys(direct).length > 0) {
      return direct;
    }

    return this.readMap(this.readFirstMessageEntry(data)['message']);
  }

  private normalizeRemoteJid(value: string): string {
    if (!value) {
      return '';
    }
    return value.includes('@') ? value : `${value.replace(/\D/g, '')}@s.whatsapp.net`;
  }

  private summarizeMessageBody(data: Record<string, unknown>): string {
    const message = this.readMessageMap(data);
    const conversation = this.readString(message['conversation']);
    if (conversation) {
      return conversation.slice(0, 80);
    }

    const extended = this.readMap(message['extendedTextMessage']);
    const extendedText = this.readString(extended['text']);
    if (extendedText) {
      return extendedText.slice(0, 80);
    }

    const type = this.guessInboundMessageType(data);
    return type === 'text' ? '(sin texto)' : `${type} recibido`;
  }

  private expandInboundPayloads(payload: Record<string, unknown>): Record<string, unknown>[] {
    const data = this.readMap(payload['data']);
    const messages = data['messages'];
    if (!Array.isArray(messages) || messages.length === 0) {
      return [payload];
    }

    const sharedData = { ...data };
    delete sharedData['messages'];

    return messages
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        ...payload,
        instance: payload['instance'] ?? data['instance'] ?? item['instance'] ?? item['instanceName'],
        instanceName:
          payload['instanceName'] ?? data['instanceName'] ?? data['instance_name'] ?? item['instanceName'],
        data: {
          ...sharedData,
          ...item,
          key: this.readMap(item['key']),
          message: this.readMap(item['message']),
        },
      }));
  }

  private describeInboundPayload(payload: Record<string, unknown>): {
    remoteJid: string;
    messageId: string;
    messageType: string;
    bodyPreview: string;
  } {
    const expanded = this.expandInboundPayloads(payload);
    const firstPayload = expanded[0] ?? payload;
    const data = this.readMap(firstPayload['data']);
    const key = this.readMap(data['key']);

    return {
      remoteJid: this.normalizeRemoteJid(this.readString(key['remoteJid'])) || '(none)',
      messageId: this.readString(key['id']) || '(none)',
      messageType: this.guessInboundMessageType(data),
      bodyPreview: this.summarizeMessageBody(data),
    };
  }

  private stringifyWhatsAppId(value: unknown): string | null {
    if (typeof value === 'string') {
      const v = value.trim();
      if (!v) return null;
      // normalize '553199999999@s.whatsapp.net' -> digits
      const digits = v.replace(/\D/g, '');
      return digits.length >= 8 ? digits : v;
    }

    if (typeof value === 'object' && value !== null) {
      const r = value as Record<string, unknown>;
      if (typeof r.id === 'string') return this.stringifyWhatsAppId(r.id);
      if (typeof r.user === 'string') return this.stringifyWhatsAppId(r.user);
      if (typeof r.phone === 'string') return this.stringifyWhatsAppId(r.phone);
    }

    return null;
  }

  private toPublic(entity: WhatsappInstanceEntity) {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      instanceName: entity.instanceName,
      status: entity.status,
      qrCode: entity.qrCode,
      phoneNumber: entity.phoneNumber,
      jid: entity.jid,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private async ensureWhatsappChannelBridge(
    companyId: string,
    instanceName: string,
    instanceStatus: string,
  ): Promise<void> {
    try {
      await this.channelsService.findOrCreateWhatsappBridge(companyId, instanceName);

      const settings = await this.evolutionService.getRuntimeSettingsSnapshot();
      const webhookUrl = this.evolutionService.buildInstanceWebhookUrl();
      await this.whatsappChannelConfigService.upsertAutomationConfig({
        companyId,
        evolutionServerUrl: settings.baseUrl,
        evolutionApiKey: settings.apiKey,
        instanceName,
        webhookUrl,
        instanceStatus,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown bridge sync error.';
      this.logger.warn(
        `[EVOLUTION INSTANCE WEBHOOK] failed to sync whatsapp channel config instanceName=${instanceName} error=${message}`,
      );
    }
  }

  private async findLatestInboundMessage(
    companyId: string,
    instanceName: string,
  ): Promise<WhatsappMessageEntity | null> {
    const config = await this.whatsappChannelConfigRepository.findOne({
      where: { companyId, provider: 'evolution', instanceName },
    });
    if (!config) {
      return null;
    }

    return this.whatsappMessageRepository.findOne({
      where: {
        companyId,
        channelConfigId: config.id,
        direction: 'inbound',
      },
      order: { createdAt: 'DESC' },
    });
  }

  private readSessionString(
    entity: WhatsappInstanceEntity,
    scopeKey: string,
    nestedKey: string,
  ): string | null {
    const scope = entity.sessionData?.[scopeKey];
    if (typeof scope !== 'object' || scope == null) {
      return null;
    }

    const value = (scope as Record<string, unknown>)[nestedKey];
    const normalized = this.readString(value);
    return normalized.length === 0 ? null : normalized;
  }

  private readMessagePreview(message: WhatsappMessageEntity | null): string | null {
    if (!message) {
      return null;
    }

    return message.textBody?.trim() ||
      message.caption?.trim() ||
      (message.messageType == 'text' ? 'Mensaje recibido' : '${message.messageType} recibido');
  }

  private computeActivityState(params: {
    connected: boolean;
    webhookConfigured: boolean;
    lastInboundMessageAt: string | null;
    lastError: string | null;
  }): { badge: 'healthy' | 'quiet' | 'inactive' | 'issue'; label: string } {
    if (params.lastError != null && params.lastError.length > 0) {
      return {
        badge: 'issue',
        label: 'Se detectó un problema reciente en la operación del canal',
      };
    }

    if (!params.webhookConfigured) {
      return {
        badge: 'issue',
        label: 'Webhook inactivo o fuera de sincronización',
      };
    }

    if (!params.connected) {
      return {
        badge: 'inactive',
        label: 'El canal no está conectado en este momento',
      };
    }

    if (params.lastInboundMessageAt == null) {
      return {
        badge: 'quiet',
        label: 'Aún no se detectan mensajes',
      };
    }

    const inboundAt = new Date(params.lastInboundMessageAt);
    if (Number.isNaN(inboundAt.getTime())) {
      return {
        badge: 'quiet',
        label: 'Webhook activo pero sin actividad reciente',
      };
    }

    const minutes = Math.floor((Date.now() - inboundAt.getTime()) / 60000);
    if (minutes <= 10) {
      return {
        badge: 'healthy',
        label: 'Recibiendo mensajes correctamente',
      };
    }

    return {
      badge: 'quiet',
      label: 'Webhook activo pero sin actividad reciente',
    };
  }
}
