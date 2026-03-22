import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from './common/database/database.module';
import { AppErrorsController } from './common/errors/app-errors.controller';
import { AppErrorLogService } from './common/errors/app-error-log.service';
import { GlobalExceptionFilter } from './common/errors/global-exception.filter';
import { HealthController } from './common/health/health.controller';
import { EvolutionWebhookModule } from './modules/evolution-webhook/evolution-webhook.module';
import { WhatsappInstancesModule } from './modules/whatsapp-instances/whatsapp-instances.module';
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
import { BillingModule } from './modules/billing/billing.module';
import { BotConfigurationModule } from './modules/bot-configuration/bot-configuration.module';
import { BotCenterModule } from './modules/bot-center/bot-center.module';
import { AiBrainModule } from './modules/ai_brain/ai-brain.module';
import { WhatsappChannelModule } from './modules/whatsapp-channel/whatsapp-channel.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env/backend.env', '../.env/backend.env'],
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
    BillingModule,
    BotConfigurationModule,
    StorageModule,
    AiBrainModule,
    WorkersModule,
    EvolutionWebhookModule,
    WhatsappInstancesModule,
    WhatsappChannelModule,
    BotCenterModule,
  ],
  controllers: [HealthController, AppErrorsController],
  providers: [AppErrorLogService, GlobalExceptionFilter],
})
export class AppModule {}