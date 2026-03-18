import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { BotConfigurationEntity } from '../bot-configuration/entities/bot-configuration.entity';
import { ChannelsModule } from '../channels/channels.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { WorkersModule } from '../workers/workers.module';
import { EvolutionWebhookController } from './controllers/evolution-webhook.controller';
import { WhatsappWebhookController } from './controllers/whatsapp-webhook.controller';
import { EvolutionWebhookService } from './services/evolution-webhook.service';

@Module({
  imports: [
    WorkersModule,
    AiEngineModule,
    ChannelsModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    TypeOrmModule.forFeature([BotConfigurationEntity]),
  ],
  controllers: [EvolutionWebhookController, WhatsappWebhookController],
  providers: [EvolutionWebhookService],
  exports: [EvolutionWebhookService],
})
export class EvolutionWebhookModule {}