import { Injectable } from '@nestjs/common';

import { AppErrorLogEntry, AppErrorLogQuery } from './app-error.types';

const MAX_LOG_ENTRIES = 250;

@Injectable()
export class AppErrorLogService {
  private readonly entries: AppErrorLogEntry[] = [];

  add(entry: AppErrorLogEntry): void {
    this.entries.unshift(entry);
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.length = MAX_LOG_ENTRIES;
    }
  }

  list(query: AppErrorLogQuery = {}): { items: AppErrorLogEntry[]; total: number } {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const includeStack = query.debug && process.env.NODE_ENV !== 'production';

    return {
      items: this.entries.slice(0, limit).map((entry) => ({
        ...entry,
        ...(includeStack ? {} : { stack: undefined }),
      })),
      total: this.entries.length,
    };
  }
}