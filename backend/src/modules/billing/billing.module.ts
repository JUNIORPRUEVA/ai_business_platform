import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PlanEntity } from './entities/plan.entity';
import { SubscriptionEntity } from './entities/subscription.entity';
import { LicenseGuard } from './license.guard';
import { LicenseService } from './license.service';
import { PaypalClient } from './paypal.client';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([PlanEntity, SubscriptionEntity])],
  controllers: [BillingController],
  providers: [BillingService, PaypalClient, LicenseService, LicenseGuard],
  exports: [BillingService, LicenseService, LicenseGuard, TypeOrmModule],
})
export class BillingModule {}
