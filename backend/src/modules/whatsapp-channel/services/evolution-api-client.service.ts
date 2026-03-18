import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

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
    this.assertValidSendTarget(body, 'send-text');
    return this.request(
      config,
      `/message/sendText/${encodeURIComponent(config.instanceName)}`,
      { method: 'POST', body: JSON.stringify(body) },
      'send-text',
    );
  }

  async sendMedia(config: WhatsappChannelConfigEntity, body: JsonRecord): Promise<JsonRecord> {
    this.assertValidSendTarget(body, 'send-media');
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
    this.assertValidSendTarget(body, 'send-whatsapp-audio');
    return this.request(
      config,
      `/message/sendWhatsAppAudio/${encodeURIComponent(config.instanceName)}`,
      { method: 'POST', body: JSON.stringify(body) },
      'send-whatsapp-audio',
    );
  }

  private assertValidSendTarget(body: JsonRecord, action: string): void {
    const raw = body['number'];
    const number = typeof raw === 'string' ? raw.trim() : '';
    if (!number) {
      throw new BadRequestException(
        `[EVOLUTION SEND VALIDATION] missing number for action=${action}`,
      );
    }

    if (number.includes('@')) {
      throw new BadRequestException(
        `[EVOLUTION SEND VALIDATION] invalid number contains '@' action=${action} number=${number}`,
      );
    }

    const digits = number.replace(/\D/g, '');
    if (digits !== number) {
      throw new BadRequestException(
        `[EVOLUTION SEND VALIDATION] invalid number must be digits-only action=${action} number=${number}`,
      );
    }

    if (digits.length < 10 || digits.length > 15) {
      throw new BadRequestException(
        `[EVOLUTION SEND VALIDATION] invalid number length action=${action} length=${digits.length} number=${number}`,
      );
    }
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

        const requestBody = typeof init.body === 'string' ? init.body : '';

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

        if (!response.ok) {
          const compactBody = text && text.length > 2000 ? `${text.slice(0, 2000)}…(truncated)` : (text || '(empty)');
          this.logger.warn(
            `[EVOLUTION API] failure action=${eventName} instanceName=${config.instanceName} endpoint=${url} status=${response.status} request=${requestBody || '{}'} response=${compactBody}`,
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
          const errorMessage =
            this.extractErrorMessage(payload, text) || `Evolution API error (${response.status}).`;

          if (response.status >= 400 && response.status < 500) {
            throw new BadRequestException(errorMessage);
          }

          throw new ServiceUnavailableException(errorMessage);
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
    // Evolution error payloads vary; some deployments wrap details under `response.message`.
    // Prefer the most specific/structured message to avoid surfacing only "Bad Request".

    const response = payload['response'];
    if (typeof response === 'object' && response !== null) {
      const responseMessage = (response as Record<string, unknown>)['message'];
      const detailed = this.stringifyEvolutionMessage(responseMessage);
      if (detailed) {
        return detailed;
      }
    }

    const topMessage = payload['message'];
    const topDetailed = this.stringifyEvolutionMessage(topMessage);
    if (topDetailed) {
      return topDetailed;
    }

    const error = payload['error'];
    if (typeof error === 'string' && error.trim()) {
      // If we only have a generic string, fall back to the raw text to keep details.
      const cleanedFallback = fallback.trim();
      if (cleanedFallback && cleanedFallback.toLowerCase() !== error.trim().toLowerCase()) {
        return cleanedFallback;
      }
      return error.trim();
    }

    const raw = payload['raw'];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }

    return fallback.trim();
  }

  private stringifyEvolutionMessage(value: unknown): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (Array.isArray(value)) {
      const items = value
        .map((item) => {
          if (typeof item === 'string') {
            return item.trim();
          }
          if (typeof item === 'object' && item !== null) {
            const r = item as Record<string, unknown>;
            const exists = r['exists'];
            const number = typeof r['number'] === 'string' ? r['number'].trim() : '';
            const jid = typeof r['jid'] === 'string' ? r['jid'].trim() : '';
            if (exists === false && number) {
              return `El número ${number} no existe en WhatsApp${jid ? ` (jid: ${jid})` : ''}.`;
            }
            return JSON.stringify(item);
          }
          return '';
        })
        .filter((s) => s);

      const joined = items.join(' | ');
      return joined.length > 2000 ? `${joined.slice(0, 2000)}…(truncated)` : joined;
    }

    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value);
        return json.length > 2000 ? `${json.slice(0, 2000)}…(truncated)` : json;
      } catch {
        return '';
      }
    }

    return '';
  }
}