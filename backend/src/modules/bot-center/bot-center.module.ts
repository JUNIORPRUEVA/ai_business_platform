import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseModule } from '../../common/database/database.module';
import { AiBrainModule } from '../ai_brain/ai-brain.module';
import { ClientMemoryEntity } from '../ai_brain/entities/client-memory.entity';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { ContactMemoryEntity } from '../ai-engine/entities/contact-memory.entity';
import { ConversationMemoryEntity } from '../ai-engine/entities/conversation-memory.entity';
import { ConversationSummaryEntity } from '../ai-engine/entities/conversation-summary.entity';
import { BotConfigurationModule } from '../bot-configuration/bot-configuration.module';
import { BillingModule } from '../billing/billing.module';
import { ChannelsModule } from '../channels/channels.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ContactEntity } from '../contacts/entities/contact.entity';
import { ConversationsModule } from '../conversations/conversations.module';
import { ConversationEntity } from '../conversations/entities/conversation.entity';
import { MessagesModule } from '../messages/messages.module';
import { MessageEntity } from '../messages/entities/message.entity';
import { StorageModule } from '../storage/storage.module';
import { WhatsappChannelModule } from '../whatsapp-channel/whatsapp-channel.module';
import { WhatsappChannelConfigEntity } from '../whatsapp-channel/entities/whatsapp-channel-config.entity';
import { WhatsappChannelLogEntity } from '../whatsapp-channel/entities/whatsapp-channel-log.entity';
import { WhatsappChatEntity } from '../whatsapp-channel/entities/whatsapp-chat.entity';
import { WhatsappMessageEntity } from '../whatsapp-channel/entities/whatsapp-message.entity';
import { BotCenterController } from './controllers/bot-center.controller';
import { BotCenterService } from './services/bot-center.service';

@Module({
  imports: [
    AiBrainModule,
    AiEngineModule,
    BotConfigurationModule,
    BillingModule,
    ChannelsModule,
    ContactsModule,
    ConversationsModule,
    DatabaseModule,
    MessagesModule,
    StorageModule,
    WhatsappChannelModule,
    TypeOrmModule.forFeature([
      ClientMemoryEntity,
      ContactMemoryEntity,
      ConversationMemoryEntity,
      ConversationSummaryEntity,
      ContactEntity,
      ConversationEntity,
      MessageEntity,
      WhatsappChannelConfigEntity,
      WhatsappChatEntity,
      WhatsappMessageEntity,
      WhatsappChannelLogEntity,
    ]),
  ],
  controllers: [BotCenterController],
  providers: [BotCenterService],
  exports: [BotCenterService],
})
export class BotCenterModule {}
