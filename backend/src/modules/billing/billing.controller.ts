import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.billingService.getMe(user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-subscription')
  async createSubscription(@CurrentUser() user: AuthUser) {
    return await this.billingService.createPaypalSubscription(user.companyId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel-subscription')
  async cancelSubscription(@CurrentUser() user: AuthUser) {
    return await this.billingService.cancelPaypalSubscription(user.companyId);
  }

  @Post('webhook')
  webhook(@Body() body: any) {
    return this.billingService.handleWebhook(body);
  }
}
