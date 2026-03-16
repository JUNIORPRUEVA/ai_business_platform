import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
export declare class HealthController {
    private readonly configService;
    private readonly databaseService;
    constructor(configService: ConfigService, databaseService: DatabaseService);
    getHealth(): {
        status: string;
        environment: string;
        timestamp: string;
        database: import("../database/database.types").DatabaseHealthReport;
    };
}
