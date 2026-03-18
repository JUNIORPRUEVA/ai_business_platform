import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ConfigureWhatsappWebhookDto } from '../dto/configure-whatsapp-webhook.dto';
import { SaveWhatsappChannelConfigDto } from '../dto/save-whatsapp-channel-config.dto';
import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { EvolutionApiClientService } from './evolution-api-client.service';
import { WhatsappSecretService } from './whatsapp-secret.service';

const DEFAULT_WEBHOOK_EVENTS = [
  'QRCODE_UPDATED',
  'CONNECTION_UPDATE',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
];

@Injectable()
export class WhatsappChannelConfigService {
  constructor(
    @InjectRepository(WhatsappChannelConfigEntity)
    private readonly configsRepository: Repository<WhatsappChannelConfigEntity>,
    private readonly evolutionApiClient: EvolutionApiClientService,
    private readonly secretService: WhatsappSecretService,
  ) {}

  assertCompanyAccess(currentCompanyId: string, requestedCompanyId: string): void {
    if (currentCompanyId !== requestedCompanyId) {
      throw new ForbiddenException('No puedes acceder a otra empresa.');
    }
  }

  async create(companyId: string, payload: SaveWhatsappChannelConfigDto) {
    const existing = await this.configsRepository.findOne({ where: { companyId, provider: 'evolution' } });
    if (existing) {
      throw new BadRequestException('La configuracion de WhatsApp ya existe para esta empresa.');
    }

    if (!payload.evolutionServerUrl || !payload.evolutionApiKey || !payload.instanceName) {
      throw new BadRequestException('Debes enviar servidor, api key e instanceName.');
    }

    const entity = this.configsRepository.create({
      companyId,
      provider: 'evolution',
      evolutionServerUrl: payload.evolutionServerUrl.trim().replace(/\/$/, ''),
      evolutionApiKeyEncrypted: this.secretService.encrypt(payload.evolutionApiKey),
      instanceName: this.normalizeInstanceName(payload.instanceName),
      webhookEnabled: payload.webhookEnabled ?? true,
      webhookUrl: payload.webhookUrl?.trim() || null,
      webhookByEvents: payload.webhookByEvents ?? false,
      webhookBase64: payload.webhookBase64 ?? false,
      webhookEventsJson: this.normalizeWebhookEvents(payload.webhookEvents),
      isActive: payload.isActive ?? true,
      instancePhone: null,
      instanceStatus: 'disconnected',
      lastSyncAt: null,
    });

    return this.toView(await this.configsRepository.save(entity));
  }

  async get(companyId: string): Promise<Record<string, unknown>> {
    return this.toView(await this.getEntity(companyId));
  }

  async update(companyId: string, payload: SaveWhatsappChannelConfigDto): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);

    if (payload.evolutionServerUrl != null) {
      entity.evolutionServerUrl = payload.evolutionServerUrl.trim().replace(/\/$/, '');
    }
    if (payload.evolutionApiKey != null && payload.evolutionApiKey.trim().length > 0) {
      entity.evolutionApiKeyEncrypted = this.secretService.encrypt(payload.evolutionApiKey);
    }
    if (payload.instanceName != null) {
      entity.instanceName = this.normalizeInstanceName(payload.instanceName);
    }
    if (payload.webhookEnabled != null) {
      entity.webhookEnabled = payload.webhookEnabled;
    }
    if (payload.webhookUrl != null) {
      entity.webhookUrl = payload.webhookUrl.trim() || null;
    }
    if (payload.webhookByEvents != null) {
      entity.webhookByEvents = payload.webhookByEvents;
    }
    if (payload.webhookBase64 != null) {
      entity.webhookBase64 = payload.webhookBase64;
    }
    if (payload.webhookEvents != null) {
      entity.webhookEventsJson = this.normalizeWebhookEvents(payload.webhookEvents);
    }
    if (payload.isActive != null) {
      entity.isActive = payload.isActive;
    }

    return this.toView(await this.configsRepository.save(entity));
  }

  async testConnection(companyId: string): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);
    const result = await this.evolutionApiClient.testConnection(entity);
    return {
      ok: true,
      companyId,
      instanceName: entity.instanceName,
      response: result,
    };
  }

  async getStatus(companyId: string): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);
    const response = await this.evolutionApiClient.getInstanceStatus(entity);
    const status = this.normalizeInstanceStatus(response);

    entity.instanceStatus = status;
    entity.lastSyncAt = new Date();
    await this.configsRepository.save(entity);

    return {
      companyId,
      instanceName: entity.instanceName,
      instancePhone: entity.instancePhone,
      instanceStatus: status,
      raw: response,
      lastSyncAt: entity.lastSyncAt?.toISOString(),
    };
  }

  async syncInstance(companyId: string): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);
    const [status, qr] = await Promise.all([
      this.evolutionApiClient.getInstanceStatus(entity),
      this.evolutionApiClient.getQr(entity).catch(() => ({})),
    ]);

    entity.instanceStatus = this.normalizeInstanceStatus(status);
    entity.instancePhone = this.extractPhone(status) ?? entity.instancePhone;
    entity.lastSyncAt = new Date();
    await this.configsRepository.save(entity);

    return {
      companyId,
      instanceName: entity.instanceName,
      instanceStatus: entity.instanceStatus,
      instancePhone: entity.instancePhone,
      qr,
      raw: status,
    };
  }

  async disconnect(companyId: string): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);
    const response = await this.evolutionApiClient.disconnect(entity);
    entity.instanceStatus = 'disconnected';
    entity.lastSyncAt = new Date();
    await this.configsRepository.save(entity);
    return { ok: true, response };
  }

  async reconnect(companyId: string): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);
    const qr = await this.evolutionApiClient.getQr(entity);
    entity.instanceStatus = 'connecting';
    entity.lastSyncAt = new Date();
    await this.configsRepository.save(entity);
    return {
      ok: true,
      instanceStatus: entity.instanceStatus,
      qr,
    };
  }

  async configureWebhook(
    companyId: string,
    payload: ConfigureWhatsappWebhookDto,
  ): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);
    this.applyWebhookOverrides(entity, payload);

    if (!entity.webhookEnabled) {
      throw new BadRequestException('El webhook esta desactivado para esta empresa.');
    }
    if (!entity.webhookUrl) {
      throw new BadRequestException('Debes guardar webhookUrl antes de configurar el webhook.');
    }

    const evolutionPayload = this.buildWebhookPayload(entity);
    const remote = await this.evolutionApiClient.setWebhook(entity, evolutionPayload);

    entity.lastSyncAt = new Date();
    await this.configsRepository.save(entity);

    return {
      local: this.toWebhookView(entity),
      remote,
      inSync: true,
    };
  }

  async getWebhook(companyId: string): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);
    const remote = await this.evolutionApiClient.findWebhook(entity).catch((error) => ({
      error: error instanceof Error ? error.message : 'Webhook query failed.',
    }));

    return {
      local: this.toWebhookView(entity),
      remote,
      inSync: this.compareWebhook(entity, remote),
    };
  }

  async syncWebhook(companyId: string): Promise<Record<string, unknown>> {
    const entity = await this.getEntity(companyId);
    const remote = await this.evolutionApiClient.findWebhook(entity);
    entity.lastSyncAt = new Date();
    await this.configsRepository.save(entity);

    return {
      local: this.toWebhookView(entity),
      remote,
      inSync: this.compareWebhook(entity, remote),
    };
  }

  async getEntity(companyId: string): Promise<WhatsappChannelConfigEntity> {
    const entity = await this.configsRepository.findOne({ where: { companyId, provider: 'evolution' } });
    if (!entity) {
      throw new NotFoundException('No existe configuracion de WhatsApp para esta empresa.');
    }
    return entity;
  }

  private toView(entity: WhatsappChannelConfigEntity): Record<string, unknown> {
    return {
      id: entity.id,
      companyId: entity.companyId,
      provider: entity.provider,
      evolutionServerUrl: entity.evolutionServerUrl,
      evolutionApiKeyMasked: this.secretService.mask(
        this.secretService.decrypt(entity.evolutionApiKeyEncrypted),
      ),
      instanceName: entity.instanceName,
      instancePhone: entity.instancePhone,
      instanceStatus: entity.instanceStatus,
      webhookEnabled: entity.webhookEnabled,
      webhookUrl: entity.webhookUrl,
      webhookByEvents: entity.webhookByEvents,
      webhookBase64: entity.webhookBase64,
      webhookEvents: entity.webhookEventsJson,
      isActive: entity.isActive,
      lastSyncAt: entity.lastSyncAt?.toISOString(),
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toWebhookView(entity: WhatsappChannelConfigEntity): Record<string, unknown> {
    return {
      webhookEnabled: entity.webhookEnabled,
      webhookUrl: entity.webhookUrl,
      webhookByEvents: entity.webhookByEvents,
      webhookBase64: entity.webhookBase64,
      webhookEvents: entity.webhookEventsJson,
      lastSyncAt: entity.lastSyncAt?.toISOString(),
    };
  }

  private buildWebhookPayload(entity: WhatsappChannelConfigEntity): Record<string, unknown> {
    return {
      enabled: entity.webhookEnabled,
      url: entity.webhookUrl,
      webhookByEvents: entity.webhookByEvents,
      webhookBase64: entity.webhookBase64,
      events: entity.webhookEventsJson,
    };
  }

  private compareWebhook(
    entity: WhatsappChannelConfigEntity,
    remote: Record<string, unknown>,
  ): boolean {
    const remoteUrl = this.readString(remote['url']) || this.readString(remote['webhookUrl']);
    const remoteEvents = this.readStringArray(remote['events']);
    return remoteUrl === (entity.webhookUrl ?? '') &&
      JSON.stringify(remoteEvents.sort()) === JSON.stringify([...entity.webhookEventsJson].sort());
  }

  private normalizeInstanceName(value: string): string {
    const normalized = value.trim().replace(/\s+/g, '_');
    if (!normalized) {
      throw new BadRequestException('instanceName es obligatorio.');
    }
    return normalized;
  }

  private normalizeWebhookEvents(value?: string[]): string[] {
    if (value == null || value.length === 0) {
      return [...DEFAULT_WEBHOOK_EVENTS];
    }
    const normalized = [...new Set(
      value
        .map((event) => event.trim())
        .filter((event) => event.length > 0),
    )];
    if (normalized.length === 0) {
      return [...DEFAULT_WEBHOOK_EVENTS];
    }
    return normalized;
  }

  private applyWebhookOverrides(
    entity: WhatsappChannelConfigEntity,
    payload: ConfigureWhatsappWebhookDto,
  ): void {
    if (payload.webhookEnabled != null) {
      entity.webhookEnabled = payload.webhookEnabled;
    }
    if (payload.webhookUrl != null) {
      entity.webhookUrl = payload.webhookUrl.trim() || null;
    }
    if (payload.webhookByEvents != null) {
      entity.webhookByEvents = payload.webhookByEvents;
    }
    if (payload.webhookBase64 != null) {
      entity.webhookBase64 = payload.webhookBase64;
    }
    if (payload.webhookEvents != null) {
      entity.webhookEventsJson = this.normalizeWebhookEvents(payload.webhookEvents);
    }
  }

  private normalizeInstanceStatus(payload: Record<string, unknown>): string {
    const raw = this.readString(payload['status']) ||
      this.readString(payload['state']) ||
      this.readString(this.readMap(payload['instance'])['state']);
    const normalized = raw.toLowerCase();
    if (normalized.includes('connect') && !normalized.includes('disconnect')) {
      return normalized.includes('connecting') ? 'connecting' : 'connected';
    }
    if (normalized.includes('open')) {
      return 'connected';
    }
    if (
      normalized.includes('close') ||
      normalized.includes('disconnect') ||
      normalized.includes('offline')
    ) {
      return 'disconnected';
    }
    return raw.length === 0 ? 'unknown' : raw;
  }

  private extractPhone(payload: Record<string, unknown>): string | null {
    const direct = this.readString(payload['number']) ||
      this.readString(payload['phone']) ||
      this.readString(this.readMap(payload['instance'])['number']);
    return direct.length === 0 ? null : direct;
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private readMap(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : {};
  }

  private readStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  }
}