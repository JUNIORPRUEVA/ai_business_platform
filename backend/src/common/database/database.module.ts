import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';

import { DatabaseService } from './database.service';
import { resolvePostgresConnectionSettings } from './postgres-config.util';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
        const isProduction = nodeEnv === 'production';

        const finalSettings = resolvePostgresConnectionSettings(
          (key) => configService.get<string>(key),
        );

        const migrations = isProduction
          ? [join(process.cwd(), 'dist', 'migrations', '*.js')]
          : [join(process.cwd(), 'src', 'migrations', '*.ts')];

        return {
          type: 'postgres' as const,
          host: finalSettings.host,
          port: finalSettings.port,
          database: finalSettings.database,
          username: finalSettings.username,
          password: finalSettings.password,
          ssl: finalSettings.ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun:
            (configService.get<string>('TYPEORM_MIGRATIONS_RUN') ?? 'true') ===
            'true',
          migrations,
          logging:
            (configService.get<string>('TYPEORM_LOGGING') ?? 'false') ===
            'true',
        };
      },
    }),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}