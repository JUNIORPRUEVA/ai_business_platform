import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EvolutionInstanceConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected';

@Injectable()
export class EvolutionService {
  private readonly logger = new Logger(EvolutionService.name);

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    const url = this.configService.get<string>('EVOLUTION_API_URL') ?? '';
    return url.replace(/\/$/, '');
  }

  private get apiKey(): string {
    return this.configService.get<string>('EVOLUTION_API_KEY') ?? '';
  }

  private assertConfigured(): void {
    if (!this.baseUrl || !this.apiKey) {
      throw new ServiceUnavailableException(
        'Evolution API is not configured (EVOLUTION_API_URL/EVOLUTION_API_KEY).',
      );
    }
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    this.assertConfigured();

    const url = `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
        ...(init.headers ?? {}),
      },
    });

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

  async createInstance(params: {
    instanceName: string;
    qrcode: boolean;
  }): Promise<unknown> {
    return this.requestJson('/instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: params.instanceName,
        qrcode: params.qrcode,
      }),
    });
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
    return this.requestJson(`/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
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

    if (s.includes('connect') && !s.includes('disconnect')) return 'connected';
    if (s.includes('open')) return 'connected';
    if (s.includes('connecting') || s.includes('pair')) return 'connecting';
    if (s.includes('close') || s.includes('disconnect') || s.includes('offline')) return 'disconnected';

    return 'disconnected';
  }
}
