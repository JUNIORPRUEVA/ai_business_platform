import { Injectable, Logger } from '@nestjs/common';

import { ChannelEntity } from '../entities/channel.entity';

@Injectable()
export class EvolutionApiService {
  private readonly logger = new Logger(EvolutionApiService.name);

  async sendTextMessage(params: {
    channel: ChannelEntity;
    to: string;
    text: string;
  }): Promise<{ sent: boolean; provider: 'evolution' | 'noop' }> {
    // Expected config shape (example):
    // {
    //   "baseUrl": "https://your-evolution.example.com",
    //   "apiKey": "...",
    //   "instance": "my-instance"
    // }
    const baseUrl = typeof params.channel.config['baseUrl'] === 'string' ? (params.channel.config['baseUrl'] as string) : '';
    const apiKey = typeof params.channel.config['apiKey'] === 'string' ? (params.channel.config['apiKey'] as string) : '';
    const instance = typeof params.channel.config['instance'] === 'string' ? (params.channel.config['instance'] as string) : '';

    if (!baseUrl || !apiKey || !instance) {
      this.logger.warn('Evolution API not configured; skipping outbound send.');
      return { sent: false, provider: 'noop' };
    }

    // NOTE: Evolution API payloads vary by deployment/version.
    // This call is intentionally minimal and should be adapted to your Evolution server.
    const url = `${baseUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: params.to,
        text: params.text,
      }),
    });

    if (!response.ok) {
      this.logger.error(`Evolution API send failed: ${response.status}`);
      return { sent: false, provider: 'evolution' };
    }

    return { sent: true, provider: 'evolution' };
  }
}
