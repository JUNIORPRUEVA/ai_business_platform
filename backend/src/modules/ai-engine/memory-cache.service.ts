import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class MemoryCacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private redis: Redis | null = null;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  async getJson<T>(key: string): Promise<T | null> {
    const client = this.getClient();
    if (!client) {
      return null;
    }

    const value = await client.get(key);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.debug(`Failed to parse cache payload for ${key}: ${(error as Error).message}`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async delete(key: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    await client.del(key);
  }

  async acquireIdempotency(key: string, ttlSeconds: number): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      return true;
    }

    const result = await client.set(key, new Date().toISOString(), 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  recentWindowKey(companyId: string, conversationId: string): string {
    return `memory:v1:${companyId}:conversation:${conversationId}:recent`;
  }

  summaryKey(companyId: string, conversationId: string): string {
    return `memory:v1:${companyId}:conversation:${conversationId}:summary`;
  }

  operationalKey(companyId: string, contactId: string): string {
    return `memory:v1:${companyId}:contact:${contactId}:operational`;
  }

  idempotencyKey(companyId: string, scope: string, value: string): string {
    return `memory:v1:${companyId}:idempotency:${scope}:${value}`;
  }

  async getHealthReport(): Promise<{
    configured: boolean;
    connected: boolean;
    state: 'healthy' | 'degraded' | 'offline';
    detail: string;
  }> {
    const host = (this.configService.get<string>('REDIS_HOST') ?? '').trim();
    const port = Number(this.configService.get<string>('REDIS_PORT') ?? 6379);

    if (!host) {
      return {
        configured: false,
        connected: false,
        state: 'offline',
        detail: 'Redis no esta configurado en REDIS_HOST.',
      };
    }

    const client = this.getClient();
    if (!client) {
      return {
        configured: true,
        connected: false,
        state: 'offline',
        detail: `Redis configurado en ${host}:${port}, pero no se pudo inicializar el cliente.`,
      };
    }

    try {
      const pong = await client.ping();
      return {
        configured: true,
        connected: pong === 'PONG',
        state: pong === 'PONG' ? 'healthy' : 'degraded',
        detail:
          pong === 'PONG'
            ? `Redis responde correctamente en ${host}:${port}.`
            : `Redis esta configurado en ${host}:${port}, pero la respuesta fue inesperada.`,
      };
    } catch (error) {
      return {
        configured: true,
        connected: false,
        state: 'offline',
        detail: `Redis configurado en ${host}:${port}, pero fallo la conexion: ${(error as Error).message}`,
      };
    }
  }

  private getClient(): Redis | null {
    if (this.initialized) {
      return this.redis;
    }

    this.initialized = true;
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
      this.logger.debug(`Redis connection failed: ${error.message}`);
    });

    return this.redis;
  }
}