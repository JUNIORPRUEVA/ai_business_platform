import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TokenCache = { token: string; expiresAt: number } | null;

@Injectable()
export class PaypalClient {
  private cache: TokenCache = null;

  constructor(private readonly configService: ConfigService) {}

  private baseUrl(): string {
    return this.configService.get<string>('PAYPAL_BASE_URL') ?? 'https://api-m.paypal.com';
  }

  private clientId(): string {
    return this.configService.get<string>('PAYPAL_CLIENT_ID') ?? '';
  }

  private secret(): string {
    return this.configService.get<string>('PAYPAL_SECRET') ?? '';
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now + 30_000) return this.cache.token;

    const clientId = this.clientId();
    const secret = this.secret();
    if (!clientId || !secret) {
      throw new InternalServerErrorException('PayPal credentials missing');
    }

    const url = `${this.baseUrl()}/v1/oauth2/token`;
    const auth = Buffer.from(`${clientId}:${secret}`).toString('base64');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`PayPal token error: ${text || res.statusText}`);
    }

    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.cache = { token: json.access_token, expiresAt: now + json.expires_in * 1000 };
    return json.access_token;
  }

  async postJson<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new InternalServerErrorException(`PayPal API error: ${text || res.statusText}`);
    }

    return (await res.json()) as T;
  }

  async postNoBody(path: string, body: unknown): Promise<void> {
    await this.postJson(path, body);
  }
}
