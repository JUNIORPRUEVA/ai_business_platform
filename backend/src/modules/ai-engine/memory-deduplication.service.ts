import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

@Injectable()
export class MemoryDeduplicationService {
  buildContentHash(parts: Array<unknown>): string {
    const normalized = parts
      .map((part) => this.normalizeHashPart(part))
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

  private normalizeHashPart(part: unknown): string {
    if (typeof part === 'string') {
      return part.trim();
    }

    if (typeof part === 'number' || typeof part === 'bigint' || typeof part === 'boolean') {
      return String(part);
    }

    if (part instanceof Date) {
      return part.toISOString();
    }

    if (Array.isArray(part)) {
      return part.map((item) => this.normalizeHashPart(item)).join(',');
    }

    if (part && typeof part === 'object') {
      try {
        return JSON.stringify(part);
      } catch {
        return '[object]';
      }
    }

    return '';
  }
}