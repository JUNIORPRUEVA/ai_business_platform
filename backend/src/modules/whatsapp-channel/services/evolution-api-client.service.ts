import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { WhatsappChannelLogService } from './whatsapp-channel-log.service';
import { WhatsappSecretService } from './whatsapp-secret.service';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class EvolutionApiClientService {
  private readonly logger = new Logger(EvolutionApiClientService.name);

  constructor(
    private readonly logsService: WhatsappChannelLogService,
    private readonly secretService: WhatsappSecretService,
  ) {}

  async testConnection(config: WhatsappChannelConfigEntity): Promise<JsonRecord> {
    return this.request(config, '/', { method: 'GET' }, 'test-connection');
  }

  async setWebhook(
    config: WhatsappChannelConfigEntity,
    body: JsonRecord,
  ): Promise<JsonRecord> {
    return this.request(
      config,
      `/webhook/set/${encodeURIComponent(config.instanceName)}`,
      { method: 'POST', body: JSON.stringify(body) },
      'set-webhook',
    );
  }

  async findWebhook(config: WhatsappChannelConfigEntity): Promise<JsonRecord> {
    return this.request(
      config,
      `/webhook/find/${encodeURIComponent(config.instanceName)}`,
      { method: 'GET' },
      'find-webhook',
    );
  }

  async sendText(config: WhatsappChannelConfigEntity, body: JsonRecord): Promise<JsonRecord> {
    return this.request(
      config,
      `/message/sendText/${encodeURIComponent(config.instanceName)}`,
      { method: 'POST', body: JSON.stringify(body) },
      'send-text',
    );
  }

  async sendMedia(config: WhatsappChannelConfigEntity, body: JsonRecord): Promise<JsonRecord> {
    return this.request(
      config,
      `/message/sendMedia/${encodeURIComponent(config.instanceName)}`,
      { method: 'POST', body: JSON.stringify(body) },
      'send-media',
    );
  }

  async sendWhatsAppAudio(
    config: WhatsappChannelConfigEntity,
    body: JsonRecord,
  ): Promise<JsonRecord> {
    return this.request(
      config,
      `/message/sendWhatsAppAudio/${encodeURIComponent(config.instanceName)}`,
      { method: 'POST', body: JSON.stringify(body) },
      'send-whatsapp-audio',
    );
  }

  async getInstanceStatus(config: WhatsappChannelConfigEntity): Promise<JsonRecord> {
    try {
      return await this.request(
        config,
        `/instance/connectionState/${encodeURIComponent(config.instanceName)}`,
        { method: 'GET' },
        'get-instance-status',
      );
    } catch {
      return this.request(
        config,
        `/instance/status/${encodeURIComponent(config.instanceName)}`,
        { method: 'GET' },
        'get-instance-status-fallback',
      );
    }
  }

  async getQr(config: WhatsappChannelConfigEntity): Promise<JsonRecord> {
    try {
      return await this.request(
        config,
        `/instance/connect/${encodeURIComponent(config.instanceName)}`,
        { method: 'GET' },
        'get-qr-connect',
      );
    } catch {
      return this.request(
        config,
        `/instance/qrcode/${encodeURIComponent(config.instanceName)}`,
        { method: 'GET' },
        'get-qr',
      );
    }
  }

  async disconnect(config: WhatsappChannelConfigEntity): Promise<JsonRecord> {
    try {
      return await this.request(
        config,
        `/instance/logout/${encodeURIComponent(config.instanceName)}`,
        { method: 'DELETE' },
        'disconnect',
      );
    } catch {
      return this.request(
        config,
        `/instance/logout/${encodeURIComponent(config.instanceName)}`,
        { method: 'POST', body: JSON.stringify({}) },
        'disconnect-post',
      );
    }
  }

  private async request(
    config: WhatsappChannelConfigEntity,
    path: string,
    init: RequestInit,
    eventName: string,
  ): Promise<JsonRecord> {
    const baseUrl = config.evolutionServerUrl.replace(/\/$/, '');
    const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    const apiKey = this.secretService.decrypt(config.evolutionApiKeyEncrypted);

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        if (path.startsWith('/webhook/')) {
          this.logger.log(
            `[EVOLUTION WEBHOOK] request action=${eventName} instanceName=${config.instanceName} endpoint=${url} payload=${typeof init.body === 'string' ? init.body : '{}'}`,
          );
        }

        const response = await fetch(url, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            apikey: apiKey,
            ...(init.headers ?? {}),
          },
        });

        const text = await response.text().catch(() => '');
        const payload = this.parseJson(text);

        if (path.startsWith('/webhook/')) {
          this.logger.log(
            `[EVOLUTION WEBHOOK] response action=${eventName} instanceName=${config.instanceName} endpoint=${url} status=${response.status} body=${text || '(empty)'}`,
          );
        }

        await this.logsService.create({
          companyId: config.companyId,
          instanceName: config.instanceName,
          direction: 'outgoing_api',
          eventName,
          endpointCalled: url,
          requestPayloadJson: this.parseJson(typeof init.body === 'string' ? init.body : ''),
          responsePayloadJson: payload,
          httpStatus: response.status,
          success: response.ok,
          errorMessage: response.ok ? null : this.extractErrorMessage(payload, text),
        });

        if (!response.ok) {
          throw new ServiceUnavailableException(
            this.extractErrorMessage(payload, text) || `Evolution API error (${response.status}).`,
          );
        }

        return payload;
      } catch (error) {
        lastError = error;
        if (attempt >= 2) {
          break;
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ServiceUnavailableException('Evolution API request failed.');
  }

  private parseJson(source: string): JsonRecord {
    if (!source.trim()) {
      return {};
    }

    try {
      const parsed = JSON.parse(source);
      return typeof parsed === 'object' && parsed !== null ? parsed as JsonRecord : { raw: parsed };
    } catch {
      return { raw: source };
    }
  }

  private extractErrorMessage(payload: JsonRecord, fallback: string): string {
    const message = payload['message'] ?? payload['error'] ?? payload['raw'];
    return typeof message === 'string' && message.trim() ? message.trim() : fallback.trim();
  }
}