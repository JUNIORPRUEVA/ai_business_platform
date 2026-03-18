import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClientMemoryEntity } from '../ai_brain/entities/client-memory.entity';
import { ChannelsModule } from '../channels/channels.module';
import { CompaniesModule } from '../companies/companies.module';
import { ContactEntity } from '../contacts/entities/contact.entity';
import { ContactsModule } from '../contacts/contacts.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { BotsModule } from '../bots/bots.module';
import { PromptsModule } from '../prompts/prompts.module';
import { ToolsModule } from '../tools/tools.module';
import { ToolEntity } from '../tools/entities/tool.entity';
import { ClientMemoryService } from './client-memory.service';
import { ContactMemoryService } from './contact-memory.service';
import { ConversationMemoryService } from './conversation-memory.service';
import { ConversationSummaryService } from './conversation-summary.service';
import { ConversationSummaryEntity } from './entities/conversation-summary.entity';
import { EvolutionModule } from '../evolution/evolution.module';
import { ContactMemoryEntity } from './entities/contact-memory.entity';
import { ConversationMemoryEntity } from './entities/conversation-memory.entity';
import { BotEngineService } from './bot-engine.service';
import { MemoryCacheService } from './memory-cache.service';
import { MemoryContextAssemblerService } from './memory-context-assembler.service';
import { MemoryDeduplicationService } from './memory-deduplication.service';
import { MemoryService } from './memory.service';
import { PromptBuilderService } from './prompt-builder.service';
import { ToolRunnerService } from './tool-runner.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      ConversationMemoryEntity,
      ContactMemoryEntity,
      ConversationSummaryEntity,
      ClientMemoryEntity,
      ContactEntity,
      ToolEntity,
    ]),
    CompaniesModule,
    ChannelsModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    BotsModule,
    PromptsModule,
    ToolsModule,
    EvolutionModule,
  ],
  providers: [
    BotEngineService,
    MemoryService,
    MemoryCacheService,
    MemoryDeduplicationService,
    ConversationMemoryService,
    ClientMemoryService,
    ContactMemoryService,
    ConversationSummaryService,
    MemoryContextAssemblerService,
    PromptBuilderService,
    ToolRunnerService,
  ],
  exports: [
    BotEngineService,
    MemoryService,
    MemoryCacheService,
    ConversationMemoryService,
    ClientMemoryService,
    ContactMemoryService,
    ConversationSummaryService,
    MemoryContextAssemblerService,
    PromptBuilderService,
    ToolRunnerService,
    EvolutionModule,
  ],
})
export class AiEngineModule {}
