import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EvolutionModule } from '../evolution/evolution.module';
import { BillingModule } from '../billing/billing.module';
import { WhatsappInstanceEntity } from './entities/whatsapp-instance.entity';
import { WhatsappInstancesController } from './controllers/whatsapp-instances.controller';
import { WhatsappInstancesService } from './services/whatsapp-instances.service';
import { EvolutionInstanceWebhookController } from './controllers/evolution-instance-webhook.controller';

@Module({
  imports: [
    ConfigModule,
    EvolutionModule,
    BillingModule,
    TypeOrmModule.forFeature([WhatsappInstanceEntity]),
  ],
  controllers: [WhatsappInstancesController, EvolutionInstanceWebhookController],
  providers: [WhatsappInstancesService],
  exports: [WhatsappInstancesService],
})
export class WhatsappInstancesModule {}
