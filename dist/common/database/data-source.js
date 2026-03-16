"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const dotenv_1 = require("dotenv");
const typeorm_1 = require("typeorm");
(0, dotenv_1.config)({ path: '.env/backend.env' });
(0, dotenv_1.config)({ path: '.env' });
const host = process.env.POSTGRES_HOST ?? 'localhost';
const port = Number(process.env.POSTGRES_PORT ?? 5432);
const database = process.env.POSTGRES_DATABASE ?? 'fulltech_bot';
const username = process.env.POSTGRES_USER ?? 'postgres';
const password = process.env.POSTGRES_PASSWORD ?? '';
const ssl = (process.env.POSTGRES_SSL ?? 'false') === 'true';
exports.default = new typeorm_1.DataSource({
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
//# sourceMappingURL=data-source.js.map