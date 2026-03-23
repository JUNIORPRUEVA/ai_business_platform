import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { WhatsappChannelConfigEntity } from '../entities/whatsapp-channel-config.entity';
import { WhatsappChannelLogService } from './whatsapp-channel-log.service';
import {
  buildEvolutionWebhookCompatPayload,
  buildEvolutionWebhookPayload,
} from './whatsapp-normalization.util';
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
    try {
      return await this.request(
        config,
        `/webhook/set/${encodeURIComponent(config.instanceName)}`,
        { method: 'POST', body: JSON.stringify(body) },
        'set-webhook',
      );
    } catch (error) {
      if (!this.requiresWebhookWrapper(error)) {
        throw error;
      }

      const compatPayload = this.toCompatWebhookPayload(body);
      this.logger.warn(
        `[EVOLUTION WEBHOOK] switching-to-compat-wrapper instanceName=${config.instanceName} reason=requires_webhook_property`,
      );

      return this.request(
        config,
        `/webhook/set/${encodeURIComponent(config.instanceName)}`,
        { method: 'POST', body: JSON.stringify(compatPayload) },
        'set-webhook-compat',
      );
    }
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

  async findContacts(
    config: WhatsappChannelConfigEntity,
    body: JsonRecord,
  ): Promise<JsonRecord> {
    return this.request(
      config,
      `/chat/findContacts/${encodeURIComponent(config.instanceName)}`,
      { method: 'POST', body: JSON.stringify(body) },
      'find-contacts',
    );
  }

  async findChats(
    config: WhatsappChannelConfigEntity,
    body: JsonRecord,
  ): Promise<JsonRecord> {
    return this.request(
      config,
      `/chat/findChats/${encodeURIComponent(config.instanceName)}`,
      { method: 'POST', body: JSON.stringify(body) },
      'find-chats',
    );
  }

  async downloadMediaUrl(
    config: WhatsappChannelConfigEntity,
    sourceUrl: string,
  ): Promise<{ buffer: Buffer; contentType: string | null; contentLength: string | null } | null> {
    const apiKey = this.secretService.decrypt(config.evolutionApiKeyEncrypted);

    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(sourceUrl, {
          method: 'GET',
          headers: {
            Accept: '*/*',
            apikey: apiKey,
          },
        });

        if (!response.ok) {
          throw new ServiceUnavailableException(
            `Evolution media download failed (${response.status}).`,
          );
        }

        const contentType = response.headers.get('content-type');
        const resolvedBody = await this.readMediaDownloadBody(response, contentType);
        if (!resolvedBody || !resolvedBody.buffer.length) {
          throw new ServiceUnavailableException('Evolution media download returned an empty body.');
        }

        return {
          buffer: resolvedBody.buffer,
          contentType: resolvedBody.contentType ?? contentType,
          contentLength: response.headers.get('content-length'),
        };
      } catch (error) {
        lastError = error;
        if (attempt >= 2) {
          break;
        }
      }
    }

    this.logger.warn(
      `[EVOLUTION API] media url download failed instanceName=${config.instanceName} url=${sourceUrl} error=${lastError instanceof Error ? lastError.message : 'unknown'}`,
    );
    return null;
  }

  private async readMediaDownloadBody(
    response: Response,
    contentTypeHeader: string | null,
  ): Promise<{ buffer: Buffer; contentType: string | null } | null> {
    const normalizedContentType = contentTypeHeader?.toLowerCase() ?? '';
    const expectsStructuredBody =
      normalizedContentType.includes('application/json') ||
      normalizedContentType.startsWith('text/');

    if (expectsStructuredBody) {
      const text = await response.text().catch(() => '');
      const payload = this.parseJson(text);
      const base64Payload = this.extractBase64Payload(payload) ?? this.extractBase64Payload(text);
      if (!base64Payload) {
        return null;
      }

      const normalized = base64Payload.includes(',')
        ? (base64Payload.split(',').pop() ?? '')
        : base64Payload;
      const buffer = Buffer.from(normalized, 'base64');
      if (!buffer.length) {
        return null;
      }

      return {
        buffer,
        contentType:
          this.extractContentType(payload, base64Payload) ??
          this.detectBinaryContentType(buffer) ??
          contentTypeHeader,
      };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      return null;
    }

    return {
      buffer,
      contentType: this.detectBinaryContentType(buffer) ?? contentTypeHeader,
    };
  }

  async downloadMediaMessage(
    config: WhatsappChannelConfigEntity,
    messagePayload: JsonRecord,
  ): Promise<{ buffer: Buffer; contentType: string | null } | null> {
    const payloadCandidates = this.buildDownloadMediaMessageCandidates(messagePayload);

    for (const body of payloadCandidates) {
      try {
        const response = await this.request(
          config,
          `/chat/getBase64FromMediaMessage/${encodeURIComponent(config.instanceName)}`,
          { method: 'POST', body: JSON.stringify(body) },
          'download-media-message',
        );
        const base64Payload = this.extractBase64Payload(response);
        if (!base64Payload) {
          continue;
        }

        const normalized = base64Payload.includes(',')
          ? (base64Payload.split(',').pop() ?? '')
          : base64Payload;
        const buffer = Buffer.from(normalized, 'base64');
        if (!buffer.length) {
          continue;
        }

        return {
          buffer,
          contentType: this.extractContentType(response, base64Payload),
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  private buildDownloadMediaMessageCandidates(messagePayload: JsonRecord): JsonRecord[] {
    const candidates: JsonRecord[] = [];
    const seen = new Set<string>();

    const push = (value: unknown): void => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return;
      }

      const candidate = value as JsonRecord;
      const serialized = JSON.stringify(candidate);
      if (seen.has(serialized)) {
        return;
      }

      seen.add(serialized);
      candidates.push(candidate);
    };

    const data = this.readMap(messagePayload['data']);
    const message = this.readMap(messagePayload['message']);
    const key = this.readMap(messagePayload['key']);
    const dataMessage = this.readMap(data['message']);
    const dataKey = this.readMap(data['key']);

    push(messagePayload);
    push(data);

    if (Object.keys(dataKey).length > 0 || Object.keys(dataMessage).length > 0) {
      push({
        ...data,
        ...(Object.keys(dataKey).length > 0 ? { key: dataKey } : {}),
        ...(Object.keys(dataMessage).length > 0 ? { message: dataMessage } : {}),
      });
      push({
        ...(Object.keys(dataKey).length > 0 ? { key: dataKey } : {}),
        ...(Object.keys(dataMessage).length > 0 ? { message: dataMessage } : {}),
      });
      push({ message: dataMessage });
      push(dataMessage);
    }

    if (Object.keys(key).length > 0 || Object.keys(message).length > 0) {
      push({
        ...(Object.keys(key).length > 0 ? { key: key } : {}),
        ...(Object.keys(message).length > 0 ? { message: message } : {}),
      });
      push({ message: message });
      push(message);
    }

    return candidates;
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

  async fetchInstances(
    config: WhatsappChannelConfigEntity,
    instanceName?: string,
  ): Promise<JsonRecord> {
    const normalizedInstanceName = (instanceName ?? config.instanceName).trim();
    if (normalizedInstanceName) {
      try {
        return await this.request(
          config,
          `/instance/fetchInstances?instanceName=${encodeURIComponent(normalizedInstanceName)}`,
          { method: 'GET' },
          'fetch-instances',
        );
      } catch {
        return this.request(
          config,
          '/instance/fetchInstances',
          { method: 'GET' },
          'fetch-instances-all',
        );
      }
    }

    return this.request(
      config,
      '/instance/fetchInstances',
      { method: 'GET' },
      'fetch-instances-all',
    );
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

  private extractBase64Payload(value: unknown): string | null {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      if (trimmed.startsWith('data:') || /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)) {
        return trimmed;
      }

      return null;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const extracted = this.extractBase64Payload(item);
        if (extracted) {
          return extracted;
        }
      }
      return null;
    }

    if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      for (const key of ['base64', 'data', 'media', 'buffer']) {
        const extracted = this.extractBase64Payload(record[key]);
        if (extracted) {
          return extracted;
        }
      }
    }

    return null;
  }

  private extractContentType(payload: JsonRecord, base64Payload: string): string | null {
    const explicit = payload['mimetype'];
    if (typeof explicit === 'string' && explicit.trim()) {
      return explicit.trim();
    }

    const dataUrlMatch = /^data:([^;]+);base64,/i.exec(base64Payload);
    if (dataUrlMatch?.[1]) {
      return dataUrlMatch[1];
    }

    return null;
  }

  private detectBinaryContentType(buffer: Buffer): string | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }

    if (buffer.length >= 4 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
      return 'video/mp4';
    }

    if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') {
      return 'audio/ogg';
    }

    if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') {
      return 'audio/mpeg';
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WAVE'
    ) {
      return 'audio/wav';
    }

    return null;
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

  private readMap(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonRecord)
      : {};
  }

  private requiresWebhookWrapper(error: unknown): boolean {
    const message = error instanceof Error ? error.message : '';
    return /requires property\s+"webhook"/i.test(message);
  }

  private toCompatWebhookPayload(body: JsonRecord): JsonRecord {
    const webhookBody = typeof body['webhook'] === 'object' && body['webhook'] != null
      ? (body['webhook'] as JsonRecord)
      : body;

    const enabled = typeof webhookBody['enabled'] === 'boolean' ? webhookBody['enabled'] : true;
    const url = typeof webhookBody['url'] === 'string' ? webhookBody['url'] : '';
    const webhookByEvents =
      typeof webhookBody['webhookByEvents'] === 'boolean'
        ? webhookBody['webhookByEvents']
        : typeof webhookBody['webhook_by_events'] === 'boolean'
          ? (webhookBody['webhook_by_events'] as boolean)
          : true;
    const webhookBase64 =
      typeof webhookBody['webhookBase64'] === 'boolean'
        ? webhookBody['webhookBase64']
        : typeof webhookBody['webhook_base64'] === 'boolean'
          ? (webhookBody['webhook_base64'] as boolean)
          : false;
    const events = Array.isArray(webhookBody['events'])
      ? (webhookBody['events'] as string[])
      : [];

    if (!url.trim()) {
      return buildEvolutionWebhookCompatPayload({
        enabled,
        url: '',
        webhookByEvents,
        webhookBase64,
        events,
      });
    }

    const normalizedFlat = buildEvolutionWebhookPayload({
      enabled,
      url,
      webhookByEvents,
      webhookBase64,
      events,
    });

    return buildEvolutionWebhookCompatPayload({
      enabled: normalizedFlat.enabled,
      url: normalizedFlat.url,
      webhookByEvents,
      webhookBase64,
      events: normalizedFlat.events,
    });
  }
}
