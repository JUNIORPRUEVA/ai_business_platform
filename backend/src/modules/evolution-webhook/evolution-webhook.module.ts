import { Module } from '@nestjs/common';

import { ChannelsModule } from '../channels/channels.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesModule } from '../messages/messages.module';
import { WorkersModule } from '../workers/workers.module';
import { EvolutionWebhookController } from './controllers/evolution-webhook.controller';
import { WhatsappWebhookController } from './controllers/whatsapp-webhook.controller';
import { EvolutionWebhookService } from './services/evolution-webhook.service';

@Module({
  imports: [WorkersModule, ChannelsModule, ContactsModule, ConversationsModule, MessagesModule],
  controllers: [EvolutionWebhookController, WhatsappWebhookController],
  providers: [EvolutionWebhookService],
  exports: [EvolutionWebhookService],
})
export class EvolutionWebhookModule {}