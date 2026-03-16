import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DatabaseHealthReport,
  PostgresConnectionSettings,
} from './database.types';

@Injectable()
export class DatabaseService {
  constructor(private readonly configService: ConfigService) {}

  getPostgresSettings(): PostgresConnectionSettings {
    return {
      host: this.configService.get<string>('POSTGRES_HOST') ?? 'localhost',
      port: Number(this.configService.get<string>('POSTGRES_PORT') ?? 5432),
      database:
        this.configService.get<string>('POSTGRES_DATABASE') ?? 'fullpos_bot',
      username: this.configService.get<string>('POSTGRES_USER') ?? 'postgres',
      password: this.configService.get<string>('POSTGRES_PASSWORD') ?? '',
      ssl: (this.configService.get<string>('POSTGRES_SSL') ?? 'false') === 'true',
    };
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