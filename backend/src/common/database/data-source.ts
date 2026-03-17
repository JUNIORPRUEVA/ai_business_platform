import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { resolvePostgresConnectionSettings } from './postgres-config.util';

loadEnv({ path: '.env/backend.env' });
loadEnv({ path: '../.env/backend.env' });
loadEnv({ path: '.env' });
loadEnv({ path: '../.env' });

const settings = resolvePostgresConnectionSettings((key) => process.env[key]);

export default new DataSource({
  type: 'postgres',
  host: settings.host,
  port: settings.port,
  database: settings.database,
  username: settings.username,
  password: settings.password,
  ssl: settings.ssl ? { rejectUnauthorized: false } : false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
