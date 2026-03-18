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
import { WhatsappMessageEntity } from '../../whatsapp-channel/entities/whatsapp-message.entity';
import { WhatsappChannelConfigService } from '../../whatsapp-channel/services/whatsapp-channel-config.service';
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

    entity.status = this.mapEvolutionStatus(evoStatus);
    if (entity.status === 'connected') {
      entity.qrCode = null;
    }

    await this.repo.save(entity);
    return { status: entity.status, phoneNumber: entity.phoneNumber };
  }

  async logoutInstance(tenantId: string, instanceName: string): Promise<{ ok: true }> {
    const entity = await this.getByInstanceName(tenantId, instanceName);

    await this.evolutionService.logoutInstance(entity.instanceName);

    entity.status = 'disconnected';
    entity.qrCode = null;
    entity.phoneNumber = null;
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

  async applyWebhook(payload: {
    event?: string;
    instance?: string;
    instanceName?: string;
    data?: Record<string, unknown>;
  }): Promise<{ updated: boolean; instanceName?: string }> {
    const event = this.normalizeWebhookEventName(payload.event);
    const data = payload.data ?? {};
    const instanceName = this.resolveWebhookInstanceName(payload, data);

    this.logger.log(
      `[EVOLUTION INSTANCE WEBHOOK] received event=${event || '(empty)'} instanceName=${instanceName || '(missing)'}`,
    );

    if (!instanceName) {
      throw new BadRequestException('Missing instance in webhook payload.');
    }

    const entity = await this.repo.findOne({ where: { instanceName } });
    if (!entity) {
      this.logger.warn(`Webhook received for unknown instance: ${instanceName}`);
      return { updated: false, instanceName };
    }

    await this.ensureWhatsappChannelBridge(entity.tenantId, entity.instanceName, entity.status);

    try {
      await this.whatsappWebhookService.processNow(entity.tenantId, payload as Record<string, unknown>);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown WhatsApp channel webhook error.';
      this.logger.warn(
        `[EVOLUTION INSTANCE WEBHOOK] failed to mirror payload into whatsapp channel storage instanceName=${instanceName} error=${message}`,
      );
    }

    if (event === 'QRCODE_UPDATED') {
      const qrCode = this.extractQrCode(data);
      if (qrCode) {
        entity.qrCode = qrCode;
        if (entity.status !== 'connected') entity.status = 'connecting';
      }
      await this.repo.save(entity);
      return { updated: true, instanceName };
    }

    if (event === 'CONNECTION_UPDATE') {
      const next = this.guessStatusFromWebhook(data);
      entity.status = next ?? entity.status;
      entity.sessionData = data;

      const phone = this.extractPhoneNumber(data);
      if (phone) entity.phoneNumber = phone;

      if (entity.status === 'connected') {
        entity.qrCode = null;
      }

      await this.repo.save(entity);
      return { updated: true, instanceName };
    }

    if (event === 'MESSAGES_UPSERT') {
      const normalizedMessageType = this.guessInboundMessageType(data);
      const channel = await this.findChannelByInstanceName(entity.instanceName);

      entity.sessionData = {
        ...(entity.sessionData ?? {}),
        lastInboundMessage: {
          receivedAt: new Date().toISOString(),
          event,
          inferredType: normalizedMessageType,
          channelId: channel?.id ?? null,
        },
      };
      await this.repo.save(entity);

      if (channel) {
        await this.evolutionWebhookService.processIncomingMessage({
          channelId: channel.id,
          payload: payload as never,
        });
      }

      this.logger.log(
        `[EVOLUTION INSTANCE WEBHOOK] processed inbound message instanceName=${instanceName} channelId=${channel?.id ?? '(none)'}`,
      );

      return { updated: true, instanceName };
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
      return { updated: true, instanceName };
    }

    // For other events (e.g., messages.upsert) we currently don't persist.
    return { updated: false, instanceName };
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
    const matchesExpectedUrl = remoteWebhookUrl === expectedWebhookUrl;
    const matchesExpectedEvents =
      remoteEvents.length > 0 &&
      expectedEvents.every((event) => remoteEvents.includes(this.normalizeWebhookEvent(event)));

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

  private async findChannelByInstanceName(instanceName: string) {
    try {
      return await this.channelsService.getByInstanceNameUnsafe(instanceName);
    } catch {
      return null;
    }
  }

  private guessInboundMessageType(data: Record<string, unknown>): string {
    const message = typeof data.message === 'object' && data.message !== null
        ? (data.message as Record<string, unknown>)
        : data;

    if (message['audioMessage'] != null) return 'audio';
    if (message['imageMessage'] != null) return 'image';
    if (message['videoMessage'] != null) return 'video';
    if (message['documentMessage'] != null) return 'document';
    return 'text';
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readBoolean(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
  }

  private readStringFromMap(source: Record<string, unknown>, key: string): string {
    return this.readString(source[key]);
  }

  private readWebhookUrl(source: Record<string, unknown>): string {
    const direct =
      this.readStringFromMap(source, 'webhook') ||
      this.readStringFromMap(source, 'url') ||
      this.readStringFromMap(source, 'webhookUrl');
    if (direct) {
      return direct;
    }

    const nestedCandidates = [
      source['data'],
      source['instance'],
      source['webhookData'],
      source['webhook_data'],
    ];

    for (const candidate of nestedCandidates) {
      if (typeof candidate !== 'object' || candidate == null) {
        continue;
      }

      const map = candidate as Record<string, unknown>;
      const nested =
        this.readStringFromMap(map, 'webhook') ||
        this.readStringFromMap(map, 'url') ||
        this.readStringFromMap(map, 'webhookUrl');
      if (nested) {
        return nested;
      }
    }

    return '';
  }

  private readWebhookEvents(source: Record<string, unknown>): string[] {
    const direct = this.readStringArrayFromMap(source, 'events');
    if (direct.length > 0) {
      return direct.map((event) => this.normalizeWebhookEvent(event));
    }

    const nestedCandidates = [
      source['data'],
      source['instance'],
      source['webhookData'],
      source['webhook_data'],
    ];

    for (const candidate of nestedCandidates) {
      if (typeof candidate !== 'object' || candidate == null) {
        continue;
      }

      const nested = this.readStringArrayFromMap(candidate as Record<string, unknown>, 'events');
      if (nested.length > 0) {
        return nested.map((event) => this.normalizeWebhookEvent(event));
      }
    }

    return [];
  }

  private normalizeWebhookEvent(event: string): string {
    const normalized = event.trim().toUpperCase();
    switch (normalized) {
      case 'MESSAGES_UPSERT':
      case 'MESSAGES.UPSERT':
        return 'MESSAGES_UPSERT';
      case 'MESSAGES_UPDATE':
      case 'MESSAGES.UPDATE':
        return 'MESSAGES_UPDATE';
      case 'MESSAGES_DELETE':
      case 'MESSAGES.DELETE':
        return 'MESSAGES_DELETE';
      case 'SEND_MESSAGE':
      case 'SEND.MESSAGE':
        return 'SEND_MESSAGE';
      case 'CONNECTION_UPDATE':
      case 'CONNECTION.UPDATE':
        return 'CONNECTION_UPDATE';
      case 'QRCODE_UPDATED':
      case 'QR_UPDATED':
      case 'QR.UPDATED':
        return 'QRCODE_UPDATED';
      default:
        return normalized;
    }
  }

  private normalizeWebhookEventName(value?: string): string {
    const raw = (value ?? '').trim();
    if (!raw) {
      return '';
    }

    const normalized = raw.toUpperCase();
    switch (normalized) {
      case 'MESSAGE.UPSERT':
      case 'MESSAGE_UPSERT':
      case 'MESSAGES.UPSERT':
      case 'MESSAGES_UPSERT':
        return 'MESSAGES_UPSERT';
      case 'CONNECTION.UPDATE':
      case 'CONNECTION.STATE':
      case 'CONNECTION_UPDATE':
        return 'CONNECTION_UPDATE';
      case 'QR.UPDATED':
      case 'QRCODE.UPDATED':
      case 'QR_UPDATED':
      case 'QRCODE_UPDATED':
        return 'QRCODE_UPDATED';
      default:
        return normalized;
    }
  }

  private resolveWebhookInstanceName(
    payload: { instance?: string; instanceName?: string },
    data: Record<string, unknown>,
  ): string {
    const direct = this.readString(payload.instance) || this.readString(payload.instanceName);
    if (direct) {
      return direct;
    }

    const nestedCandidates: Array<unknown> = [
      data['instance'],
      data['instanceName'],
      data['instance_name'],
      data['sender'],
    ];

    for (const candidate of nestedCandidates) {
      const resolved = this.readString(candidate);
      if (resolved) {
        return resolved;
      }
    }

    return '';
  }

  private readStringArrayFromMap(
    source: Record<string, unknown>,
    key: string,
  ): string[] {
    const value = source[key];
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private extractPhoneNumber(data: Record<string, unknown>): string | null {
    const candidates: Array<unknown> = [
      data.phone_number,
      data.phoneNumber,
      data.number,
      data.user,
      data.me,
      data.id,
    ];

    for (const c of candidates) {
      const maybe = this.stringifyWhatsAppId(c);
      if (maybe) return maybe;
    }

    return null;
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
    return normalized.isEmpty ? null : normalized;
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
    if (params.lastError != null && params.lastError.isNotEmpty) {
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

    final inboundAt = DateTime.tryParse(params.lastInboundMessageAt)?.toUtc();
    if (inboundAt == null) {
      return {
        badge: 'quiet',
        label: 'Webhook activo pero sin actividad reciente',
      };
    }

    final minutes = DateTime.now().toUtc().difference(inboundAt).inMinutes;
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
