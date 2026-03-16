import { ConfigService } from '@nestjs/config';
import { DatabaseHealthReport, PostgresConnectionSettings } from './database.types';
export declare class DatabaseService {
    private readonly configService;
    constructor(configService: ConfigService);
    getPostgresSettings(): PostgresConnectionSettings;
    getHealth(): DatabaseHealthReport;
}
