import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { BillingModule } from '../billing/billing.module';
import { BotConfigurationModule } from '../bot-configuration/bot-configuration.module';
import { BotsModule } from '../bots/bots.module';
import { ChannelsModule } from '../channels/channels.module';
import { CompaniesModule } from '../companies/companies.module';
import { ContactEntity } from '../contacts/entities/contact.entity';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { MessagesModule } from '../messages/messages.module';
import { OpenAiModule } from '../openai/openai.module';
import { PromptsModule } from '../prompts/prompts.module';
import { StorageModule } from '../storage/storage.module';
import { ToolEntity } from '../tools/entities/tool.entity';
import { ToolsModule } from '../tools/tools.module';
import { WhatsappMessageEntity } from '../whatsapp-channel/entities/whatsapp-message.entity';
import { WhatsappChannelModule } from '../whatsapp-channel/whatsapp-channel.module';
import { AiBrainController } from './controllers/ai-brain.controller';
import { AiBrainLogEntity } from './entities/ai-brain-log.entity';
import { ClientMemoryEntity } from './entities/client-memory.entity';
import { KnowledgeDocumentChunkEntity } from './entities/knowledge-document-chunk.entity';
import { KnowledgeDocumentEntity } from './entities/knowledge-document.entity';
import { KnowledgeIndexingProcessor } from './processors/knowledge-indexing.processor';
import { AiBrainAudioService } from './services/ai-brain-audio.service';
import { AiBrainCacheService } from './services/ai-brain-cache.service';
import { AiBrainContextBuilderService } from './services/ai-brain-context-builder.service';
import { AiBrainDocumentService } from './services/ai-brain-document.service';
import { AiBrainEmbeddingService } from './services/ai-brain-embedding.service';
import { AiBrainInboundDocumentService } from './services/ai-brain-inbound-document.service';
import { AiBrainImageService } from './services/ai-brain-image.service';
import { AiBrainKnowledgeChunkService } from './services/ai-brain-knowledge-chunk.service';
import { AiBrainKnowledgeIndexingService } from './services/ai-brain-knowledge-indexing.service';
import { AiBrainMemoryService } from './services/ai-brain-memory.service';
import { AiBrainService } from './services/ai-brain.service';
import { AiBrainToolRouterService } from './services/ai-brain-tool-router.service';
import { AiBrainVideoService } from './services/ai-brain-video.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientMemoryEntity,
      KnowledgeDocumentEntity,
      KnowledgeDocumentChunkEntity,
      AiBrainLogEntity,
      ContactEntity,
      ToolEntity,
      WhatsappMessageEntity,
    ]),
    BullModule.registerQueue({
      name: 'knowledge-indexing',
    }),
    BillingModule,
    AiEngineModule,
    BotConfigurationModule,
    CompaniesModule,
    ChannelsModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    BotsModule,
    ToolsModule,
    EvolutionModule,
    OpenAiModule,
    PromptsModule,
    StorageModule,
    WhatsappChannelModule,
  ],
  controllers: [AiBrainController],
  providers: [
    AiBrainAudioService,
    AiBrainCacheService,
    AiBrainDocumentService,
    AiBrainEmbeddingService,
    AiBrainInboundDocumentService,
    AiBrainImageService,
    AiBrainKnowledgeChunkService,
    AiBrainKnowledgeIndexingService,
    AiBrainMemoryService,
    AiBrainVideoService,
    AiBrainContextBuilderService,
    KnowledgeIndexingProcessor,
    AiBrainToolRouterService,
    AiBrainService,
  ],
  exports: [AiBrainService, AiBrainDocumentService, AiBrainMemoryService],
})
export class AiBrainModule {}
