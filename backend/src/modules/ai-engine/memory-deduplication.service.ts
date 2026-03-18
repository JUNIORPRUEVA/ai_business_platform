import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class MemoryDeduplicationService {
  buildContentHash(parts: Array<string | null | undefined>): string {
    const normalized = parts
      .map((part) => part?.trim() ?? '')
      .join('|');

    return createHash('sha256').update(normalized).digest('hex');
  }

  buildEventKey(params: {
    channel: string;
    senderId: string;
    externalMessageId?: string | null;
    timestamp?: string | null;
    type: string;
    content: string;
  }): string {
    return this.buildContentHash([
      params.channel,
      params.senderId,
      params.externalMessageId ?? '',
      params.timestamp ?? '',
      params.type,
      params.content,
    ]);
  }
}