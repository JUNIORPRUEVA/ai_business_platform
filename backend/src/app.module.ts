import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './common/database/database.module';
import { HealthController } from './common/health/health.controller';
import { EvolutionWebhookModule } from './modules/evolution-webhook/evolution-webhook.module';
import { AuthModule } from './modules/auth/auth.module';
import { AutomationsModule } from './modules/automations/automations.module';
import { BotsModule } from './modules/bots/bots.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MemoryModule } from './modules/memory/memory.module';
import { MessagesModule } from './modules/messages/messages.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { StorageModule } from './modules/storage/storage.module';
import { ToolsModule } from './modules/tools/tools.module';
import { UsersModule } from './modules/users/users.module';
import { WorkersModule } from './modules/workers/workers.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env/backend.env', '../.env/backend.env', '.env', '../.env'],
    }),
    DatabaseModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    BotsModule,
    ChannelsModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    PromptsModule,
    MemoryModule,
    ToolsModule,
    AutomationsModule,
    StorageModule,
    WorkersModule,
    EvolutionWebhookModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}