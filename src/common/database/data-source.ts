import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

loadEnv({ path: '.env/backend.env' });
loadEnv({ path: '.env' });

const host = process.env.POSTGRES_HOST ?? 'localhost';
const port = Number(process.env.POSTGRES_PORT ?? 5432);
const database = process.env.POSTGRES_DATABASE ?? 'fulltech_bot';
const username = process.env.POSTGRES_USER ?? 'postgres';
const password = process.env.POSTGRES_PASSWORD ?? '';
const ssl = (process.env.POSTGRES_SSL ?? 'false') === 'true';

export default new DataSource({
  type: 'postgres',
  host,
  port,
  database,
  username,
  password,
  ssl: ssl ? { rejectUnauthorized: false } : false,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
