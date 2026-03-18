import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseModule } from '../../common/database/database.module';
import { PersistenceModule } from '../../common/persistence/persistence.module';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { ClientMemoryEntity } from '../ai_brain/entities/client-memory.entity';
import { BillingModule } from '../billing/billing.module';
import { ChannelsModule } from '../channels/channels.module';
import { ContactEntity } from '../contacts/entities/contact.entity';
import { ConversationEntity } from '../conversations/entities/conversation.entity';
import { ContactMemoryEntity } from '../ai-engine/entities/contact-memory.entity';
import { ConversationMemoryEntity } from '../ai-engine/entities/conversation-memory.entity';
import { ConversationSummaryEntity } from '../ai-engine/entities/conversation-summary.entity';
import { BotConfigurationController } from './controllers/bot-configuration.controller';
import { BotConfigurationEntity } from './entities/bot-configuration.entity';
import { BotConfigurationService } from './services/bot-configuration.service';
import { MemoryDiagnosticsService } from './services/memory-diagnostics.service';

@Module({
  imports: [
    PersistenceModule,
    BillingModule,
    ChannelsModule,
    DatabaseModule,
    AiEngineModule,
    TypeOrmModule.forFeature([
      BotConfigurationEntity,
      ContactEntity,
      ConversationEntity,
      ConversationMemoryEntity,
      ContactMemoryEntity,
      ClientMemoryEntity,
      ConversationSummaryEntity,
    ]),
  ],
  controllers: [BotConfigurationController],
  providers: [BotConfigurationService, MemoryDiagnosticsService],
  exports: [BotConfigurationService],
})
export class BotConfigurationModule {}