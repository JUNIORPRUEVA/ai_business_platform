import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DatabaseHealthReport,
  PostgresConnectionSettings,
} from './database.types';
import { resolvePostgresConnectionSettings } from './postgres-config.util';

@Injectable()
export class DatabaseService {
  constructor(private readonly configService: ConfigService) {}

  getPostgresSettings(): PostgresConnectionSettings {
    return resolvePostgresConnectionSettings(
      (key) => this.configService.get<string>(key),
    );
  }

  getHealth(): DatabaseHealthReport {
    const settings = this.getPostgresSettings();
    return {
      driver: 'postgres',
      configured: Boolean(settings.host && settings.database && settings.username),
      persistenceMode: 'postgres',
      status: 'configured',
      settings: {
        host: settings.host,
        port: settings.port,
        database: settings.database,
        username: settings.username,
        ssl: settings.ssl,
      },
    };
  }
}