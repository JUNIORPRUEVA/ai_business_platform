import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DatabaseService } from '../database/database.service';

@Controller()
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      environment: this.configService.get<string>('NODE_ENV') ?? 'development',
      timestamp: new Date().toISOString(),
      database: this.databaseService.getHealth(),
    };
  }
}