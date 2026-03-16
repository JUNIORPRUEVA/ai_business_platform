import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChannelsModule } from '../channels/channels.module';
import { CompaniesModule } from '../companies/companies.module';
import { ContactsModule } from '../contacts/contacts.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { BotsModule } from '../bots/bots.module';
import { PromptsModule } from '../prompts/prompts.module';
import { ToolsModule } from '../tools/tools.module';
import { ToolEntity } from '../tools/entities/tool.entity';
import { EvolutionModule } from '../evolution/evolution.module';
import { ContactMemoryEntity } from './entities/contact-memory.entity';
import { ConversationMemoryEntity } from './entities/conversation-memory.entity';
import { BotEngineService } from './bot-engine.service';
import { MemoryService } from './memory.service';
import { PromptBuilderService } from './prompt-builder.service';
import { ToolRunnerService } from './tool-runner.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ConversationMemoryEntity, ContactMemoryEntity, ToolEntity]),
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
  providers: [BotEngineService, MemoryService, PromptBuilderService, ToolRunnerService],
  exports: [BotEngineService, MemoryService, PromptBuilderService, ToolRunnerService, EvolutionModule],
})
export class AiEngineModule {}
