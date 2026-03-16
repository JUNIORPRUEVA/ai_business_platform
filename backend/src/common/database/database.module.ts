import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';

import { DatabaseService } from './database.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
        const isProduction = nodeEnv === 'production';

        const host = configService.get<string>('POSTGRES_HOST') ?? 'localhost';
        const port = Number(configService.get<string>('POSTGRES_PORT') ?? 5432);
        const database =
          configService.get<string>('POSTGRES_DATABASE') ?? 'fulltech_bot';
        const username = configService.get<string>('POSTGRES_USER') ?? 'postgres';
        const password = configService.get<string>('POSTGRES_PASSWORD') ?? '';
        const ssl = (configService.get<string>('POSTGRES_SSL') ?? 'false') === 'true';

        const migrations = isProduction
          ? [join(process.cwd(), 'dist', 'migrations', '*.js')]
          : [join(process.cwd(), 'src', 'migrations', '*.ts')];

        return {
          type: 'postgres' as const,
          host,
          port,
          database,
          username,
          password,
          ssl: ssl ? { rejectUnauthorized: false } : false,
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