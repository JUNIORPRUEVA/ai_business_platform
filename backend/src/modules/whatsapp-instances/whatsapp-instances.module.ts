import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BotConfigurationEntity } from '../bot-configuration/entities/bot-configuration.entity';
import { EvolutionModule } from '../evolution/evolution.module';
import { BillingModule } from '../billing/billing.module';
import { ChannelsModule } from '../channels/channels.module';
import { EvolutionWebhookModule } from '../evolution-webhook/evolution-webhook.module';
import { WhatsappChannelModule } from '../whatsapp-channel/whatsapp-channel.module';
import { WhatsappInstanceEntity } from './entities/whatsapp-instance.entity';
import { WhatsappInstancesController } from './controllers/whatsapp-instances.controller';
import { WhatsappInstancesService } from './services/whatsapp-instances.service';
import { EvolutionInstanceWebhookController } from './controllers/evolution-instance-webhook.controller';

@Module({
  imports: [
    ConfigModule,
    EvolutionModule,
    BillingModule,
    ChannelsModule,
    EvolutionWebhookModule,
    WhatsappChannelModule,
    TypeOrmModule.forFeature([WhatsappInstanceEntity, BotConfigurationEntity]),
  ],
  controllers: [WhatsappInstancesController, EvolutionInstanceWebhookController],
  providers: [WhatsappInstancesService],
  exports: [WhatsappInstancesService],
})
export class WhatsappInstancesModule {}
