import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BotConfigurationEntity } from '../bot-configuration/entities/bot-configuration.entity';

export type EvolutionInstanceConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);
  private static readonly configurationScope = 'default';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(BotConfigurationEntity)
    private readonly botConfigurationRepository: Repository<BotConfigurationEntity>,
  ) {}

  private assertConfigured(settings: { baseUrl: string; apiKey: string }): void {
    if (!settings.baseUrl || !settings.apiKey) {
      throw new ServiceUnavailableException(
        'Evolution API is not configured. Save base URL and API key in Bot Configuration or define EVOLUTION_API_URL/EVOLUTION_API_KEY.',
      );
    }
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const settings = await this.getRuntimeSettings();
    this.assertConfigured(settings);

    const url = `${settings.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          apikey: settings.apiKey,
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown fetch error';
      this.logger.error(`Evolution API network error: ${url} :: ${message}`);
      throw new ServiceUnavailableException(
        `No se pudo conectar con Evolution API en ${settings.baseUrl}.`,
      );
    }

    const text = await res.text().catch(() => '');

    if (!res.ok) {
      this.logger.warn(`Evolution API request failed: ${res.status} ${url} :: ${text}`);
      throw new ServiceUnavailableException(
        `Evolution API error (${res.status}).`,
      );
    }

    if (!text) return {} as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      // Some endpoints may return plain text; expose as best-effort.
      return { raw: text } as T;
    }
  }

  buildWebhookUrl(channelId: string): string {
    const base = (this.configService.get<string>('EVOLUTION_WEBHOOK_BASE') ?? '').replace(/\/$/, '');
    if (!base) {
      throw new ServiceUnavailableException(
        'EVOLUTION_WEBHOOK_BASE is not configured.',
      );
    }

    // Expected: https://mi-backend.com/webhooks/evolution/{channelId}/messages
    return `${base}/${channelId}/messages`;
  }

  buildInstanceWebhookUrl(): string {
    const explicit =
      (this.configService.get<string>('EVOLUTION_INSTANCE_WEBHOOK_URL') ?? '').trim();
    if (explicit) {
      return explicit;
    }

    const publicBase =
      (this.configService.get<string>('BACKEND_PUBLIC_URL') ??
        this.configService.get<string>('APP_BACKEND_URL') ??
        '')
        .trim()
        .replace(/\/$/, '');
    if (publicBase) {
      return `${publicBase}/webhook/evolution`;
    }

    const webhookBase =
      (this.configService.get<string>('EVOLUTION_WEBHOOK_BASE') ?? '')
        .trim()
        .replace(/\/$/, '');
    if (webhookBase) {
      const derived = webhookBase.replace(/\/webhooks\/evolution$/i, '');
      return `${derived}/webhook/evolution`;
    }

    throw new ServiceUnavailableException(
      'Define EVOLUTION_INSTANCE_WEBHOOK_URL, BACKEND_PUBLIC_URL o EVOLUTION_WEBHOOK_BASE para generar el webhook de Evolution.',
    );
  }

  async createInstance(params: {
    instanceName: string;
    qrcode: boolean;
  }): Promise<unknown> {
    const integration =
      (this.configService.get<string>('EVOLUTION_INSTANCE_INTEGRATION') ??
        'WHATSAPP-BAILEYS')
        .trim() || 'WHATSAPP-BAILEYS';

    return this.requestJson('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: params.instanceName,
        qrcode: params.qrcode,
        integration,
      }),
    });
  }

  /**
   * Compat helper: some Evolution versions expose QR via GET /instance/connect/{instanceName}
   * instead of /instance/qrcode/{instanceName}.
   */
  async getQRCode(instanceName: string): Promise<unknown> {
    try {
      return await this.requestJson(
        `/instance/connect/${encodeURIComponent(instanceName)}`,
        { method: 'GET' },
      );
    } catch {
      return this.getQrCode(instanceName);
    }
  }

  /**
   * Compat helper: some Evolution versions expose connection state via
   * GET /instance/connectionState/{instanceName}.
   */
  async checkConnection(instanceName: string): Promise<{
    status: EvolutionInstanceConnectionStatus;
    raw: unknown;
  }> {
    try {
      const raw = await this.requestJson<unknown>(
        `/instance/connectionState/${encodeURIComponent(instanceName)}`,
        { method: 'GET' },
      );
      const status = this.normalizeStatus(raw);
      return { status, raw };
    } catch {
      return this.getInstanceStatus(instanceName);
    }
  }

  async setWebhook(params: {
    instanceName: string;
    url: string;
    events?: string[];
  }): Promise<unknown> {
    return this.requestJson(`/webhook/set/${encodeURIComponent(params.instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        url: params.url,
        events: params.events ?? ['messages.upsert'],
      }),
    });
  }

  async getQrCode(instanceName: string): Promise<unknown> {
    return this.requestJson(`/instance/qrcode/${encodeURIComponent(instanceName)}`, {
      method: 'GET',
    });
  }

  async getInstanceStatus(instanceName: string): Promise<{
    status: EvolutionInstanceConnectionStatus;
    raw: unknown;
  }> {
    const raw = await this.requestJson<unknown>(
      `/instance/status/${encodeURIComponent(instanceName)}`,
      { method: 'GET' },
    );

    const status = this.normalizeStatus(raw);
    return { status, raw };
  }

  async logoutInstance(instanceName: string): Promise<unknown> {
    try {
      return await this.requestJson(
        `/instance/logout/${encodeURIComponent(instanceName)}`,
        { method: 'DELETE' },
      );
    } catch {
      return this.requestJson(`/instance/logout/${encodeURIComponent(instanceName)}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    }
  }

  async deleteInstance(instanceName: string): Promise<unknown> {
    return this.requestJson(
      `/instance/delete/${encodeURIComponent(instanceName)}`,
      { method: 'DELETE' },
    );
  }

  async sendMessage(params: {
    instanceName: string;
    phone: string;
    message: string;
  }): Promise<unknown> {
    return this.requestJson(`/message/sendText/${encodeURIComponent(params.instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({
        number: params.phone,
        text: params.message,
      }),
    });
  }

  private normalizeStatus(raw: unknown): EvolutionInstanceConnectionStatus {
    // Evolution responses vary by version. We'll do best-effort normalization.
    // Common shapes observed:
    // - { state: 'open'|'close'|'connecting' ... }
    // - { status: 'connected'|'disconnected' ... }
    // - { instance: { state: ... } }

    const candidates: Array<unknown> = [];
    if (typeof raw === 'object' && raw !== null) {
      const r = raw as Record<string, unknown>;
      candidates.push(r.status, r.state, r.connectionStatus);
      if (typeof r.instance === 'object' && r.instance !== null) {
        const i = r.instance as Record<string, unknown>;
        candidates.push(i.status, i.state, i.connectionStatus);
      }
      if (typeof r.data === 'object' && r.data !== null) {
        const d = r.data as Record<string, unknown>;
        candidates.push(d.status, d.state, d.connectionStatus);
      }
    }

    const value = candidates.find((v) => typeof v === 'string') as string | undefined;
    const s = (value ?? '').toLowerCase();

    if (s.includes('connecting') || s.includes('pair')) return 'connecting';
    if (s.includes('connect') && !s.includes('disconnect')) return 'connected';
    if (s.includes('open')) return 'connected';
    if (s.includes('close') || s.includes('disconnect') || s.includes('offline')) return 'disconnected';

    return 'disconnected';
  }

  private async getRuntimeSettings(): Promise<{ baseUrl: string; apiKey: string }> {
    const snapshot = await this.botConfigurationRepository.findOne({
      where: { scope: EvolutionService.configurationScope },
    });

    const payload = snapshot?.payload as
      | { evolution?: Record<string, unknown> }
      | undefined;
    const evolution = payload?.evolution;
    const configuredBaseUrl = this.readString(evolution?.baseUrl);
    const configuredApiKey = this.readString(evolution?.apiKey);

    return {
      baseUrl: (configuredBaseUrl ||
              this.configService.get<string>('EVOLUTION_API_URL') ||
              '')
          .replace(/\/$/, ''),
      apiKey:
          configuredApiKey ||
          this.configService.get<string>('EVOLUTION_API_KEY') ||
          '',
    };
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }
}
