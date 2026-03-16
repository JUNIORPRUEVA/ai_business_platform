import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { AiBrainModule } from '../ai_brain/ai-brain.module';
import { BotsModule } from '../bots/bots.module';
import { ChannelsModule } from '../channels/channels.module';
import { PromptsModule } from '../prompts/prompts.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessageProcessingProcessor } from './processors/message-processing.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number(configService.get<string>('REDIS_PORT') ?? 6379),
          password: configService.get<string>('REDIS_PASSWORD') || undefined,
          tls: (configService.get<string>('REDIS_TLS') ?? 'false') === 'true' ? {} : undefined,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'message-processing',
    }),
    AiBrainModule,
    BotsModule,
    ChannelsModule,
    PromptsModule,
    MessagesModule,
    ConversationsModule,
  ],
  providers: [MessageProcessingProcessor],
  exports: [BullModule],
})
export class WorkersModule {}
