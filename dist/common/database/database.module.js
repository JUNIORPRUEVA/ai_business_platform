"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const node_path_1 = require("node:path");
const database_service_1 = require("./database.service");
let DatabaseModule = class DatabaseModule {
};
exports.DatabaseModule = DatabaseModule;
exports.DatabaseModule = DatabaseModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            typeorm_1.TypeOrmModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: async (configService) => {
                    const host = configService.get('POSTGRES_HOST') ?? 'localhost';
                    const port = Number(configService.get('POSTGRES_PORT') ?? 5432);
                    const database = configService.get('POSTGRES_DATABASE') ?? 'fulltech_bot';
                    const username = configService.get('POSTGRES_USER') ?? 'postgres';
                    const password = configService.get('POSTGRES_PASSWORD') ?? '';
                    const ssl = (configService.get('POSTGRES_SSL') ?? 'false') === 'true';
                    return {
                        type: 'postgres',
                        host,
                        port,
                        database,
                        username,
                        password,
                        ssl: ssl ? { rejectUnauthorized: false } : false,
                        autoLoadEntities: true,
                        synchronize: false,
                        migrationsRun: (configService.get('TYPEORM_MIGRATIONS_RUN') ?? 'true') ===
                            'true',
                        migrations: [(0, node_path_1.join)(__dirname, '..', '..', 'migrations', '*{.ts,.js}')],
                        logging: (configService.get('TYPEORM_LOGGING') ?? 'false') ===
                            'true',
                    };
                },
            }),
        ],
        providers: [database_service_1.DatabaseService],
        exports: [database_service_1.DatabaseService, typeorm_1.TypeOrmModule],
    })
], DatabaseModule);
//# sourceMappingURL=database.module.js.map