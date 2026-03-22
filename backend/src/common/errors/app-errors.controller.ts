import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../modules/auth/jwt-auth.guard';
import { AppErrorLogService } from './app-error-log.service';

@Controller('system/errors')
export class AppErrorsController {
  constructor(private readonly appErrorLogService: AppErrorLogService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('debug') debug?: string,
  ) {
    return this.appErrorLogService.list({
      limit: limit ? Number(limit) : undefined,
      debug: debug === '1' || debug === 'true',
    });
  }
}