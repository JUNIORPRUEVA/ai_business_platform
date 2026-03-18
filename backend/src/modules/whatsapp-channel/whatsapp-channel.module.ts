import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BillingModule } from '../billing/billing.module';
import { StorageModule } from '../storage/storage.module';
import { WhatsappChannelController } from './controllers/whatsapp-channel.controller';
import { WhatsappWebhookController } from './controllers/whatsapp-webhook.controller';
import { WhatsappAttachmentEntity } from './entities/whatsapp-attachment.entity';
import { WhatsappChannelConfigEntity } from './entities/whatsapp-channel-config.entity';
import { WhatsappChannelLogEntity } from './entities/whatsapp-channel-log.entity';
import { WhatsappChatEntity } from './entities/whatsapp-chat.entity';
import { WhatsappMessageEntity } from './entities/whatsapp-message.entity';
import { WhatsappWebhookProcessor } from './processors/whatsapp-webhook.processor';
import { EvolutionApiClientService } from './services/evolution-api-client.service';
import { WhatsappAttachmentService } from './services/whatsapp-attachment.service';
import { WhatsappChannelConfigService } from './services/whatsapp-channel-config.service';
import { WhatsappChannelLogService } from './services/whatsapp-channel-log.service';
import { WhatsappMessagingService } from './services/whatsapp-messaging.service';
import { WhatsappSecretService } from './services/whatsapp-secret.service';
import { WhatsappWebhookService } from './services/whatsapp-webhook.service';

@Module({
  imports: [
    ConfigModule,
    BillingModule,
    StorageModule,
    BullModule.registerQueue({ name: 'whatsapp-webhook-processing' }),
    TypeOrmModule.forFeature([
      WhatsappChannelConfigEntity,
      WhatsappChatEntity,
      WhatsappMessageEntity,
      WhatsappAttachmentEntity,
      WhatsappChannelLogEntity,
    ]),
  ],
  controllers: [WhatsappChannelController, WhatsappWebhookController],
  providers: [
    WhatsappSecretService,
    WhatsappChannelLogService,
    EvolutionApiClientService,
    WhatsappChannelConfigService,
    WhatsappAttachmentService,
    WhatsappMessagingService,
    WhatsappWebhookService,
    WhatsappWebhookProcessor,
  ],
  exports: [
    TypeOrmModule,
    WhatsappSecretService,
    WhatsappChannelLogService,
    EvolutionApiClientService,
    WhatsappChannelConfigService,
    WhatsappAttachmentService,
    WhatsappMessagingService,
    WhatsappWebhookService,
  ],
})
export class WhatsappChannelModule {}