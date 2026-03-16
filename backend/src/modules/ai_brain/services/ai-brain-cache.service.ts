import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AiBrainCacheService {
  private readonly logger = new Logger(AiBrainCacheService.name);
  private redis: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  private get client(): Redis | null {
    if (this.redis !== null) {
      return this.redis;
    }

    const host = this.configService.get<string>('REDIS_HOST') ?? '';
    if (!host) {
      this.redis = null;
      return this.redis;
    }

    this.redis = new Redis({
      host,
      port: Number(this.configService.get<string>('REDIS_PORT') ?? 6379),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      tls: (this.configService.get<string>('REDIS_TLS') ?? 'false') === 'true' ? {} : undefined,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    void this.redis.connect().catch((error: Error) => {
      this.logger.debug(`Redis connect failed: ${error.message}`);
    });

    return this.redis;
  }

  private contextKey(companyId: string, phone: string): string {
    return `chat_context:${companyId}:${phone}`;
  }

  private bufferKey(phone: string): string {
    return `chat_buffer:${phone}`;
  }

  async appendInboundBuffer(phone: string, message: string): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }

    const normalized = message.trim();
    if (!normalized) {
      return;
    }

    const key = this.bufferKey(phone);
    const next = JSON.stringify({ content: normalized, createdAt: new Date().toISOString() });
    await client.rpush(key, next);
    await client.ltrim(key, -8, -1);
    await client.expire(key, 180);
  }

  async getInboundBuffer(phone: string): Promise<string[]> {
    const client = this.client;
    if (!client) {
      return [];
    }

    const values = await client.lrange(this.bufferKey(phone), 0, -1);
    return values
      .map((value) => {
        try {
          const parsed = JSON.parse(value) as { content?: string };
          return parsed.content?.trim() ?? '';
        } catch {
          return '';
        }
      })
      .filter((value) => value.length > 0);
  }

  async storeConversationContext(params: {
    companyId: string;
    phone: string;
    detectedIntent: string;
    lastMessages: string[];
    lastResponse: string;
  }): Promise<void> {
    const client = this.client;
    if (!client) {
      return;
    }

    await client.set(
      this.contextKey(params.companyId, params.phone),
      JSON.stringify({
        detectedIntent: params.detectedIntent,
        lastMessages: params.lastMessages,
        lastResponse: params.lastResponse,
        updatedAt: new Date().toISOString(),
      }),
      'EX',
      1800,
    );
  }

  async getConversationContext(
    companyId: string,
    phone: string,
  ): Promise<{ detectedIntent?: string; lastMessages?: string[]; lastResponse?: string } | null> {
    const client = this.client;
    if (!client) {
      return null;
    }

    const value = await client.get(this.contextKey(companyId, phone));
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as {
        detectedIntent?: string;
        lastMessages?: string[];
        lastResponse?: string;
      };
    } catch {
      return null;
    }
  }
}