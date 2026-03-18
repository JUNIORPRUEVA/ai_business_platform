import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DatabaseModule } from '../../common/database/database.module';
import { BotConfigurationModule } from '../bot-configuration/bot-configuration.module';
import { BotMemoryModule } from '../bot-memory/bot-memory.module';
import { WhatsappChannelModule } from '../whatsapp-channel/whatsapp-channel.module';
import { WhatsappChannelLogEntity } from '../whatsapp-channel/entities/whatsapp-channel-log.entity';
import { WhatsappChatEntity } from '../whatsapp-channel/entities/whatsapp-chat.entity';
import { WhatsappMessageEntity } from '../whatsapp-channel/entities/whatsapp-message.entity';
import { BotCenterController } from './controllers/bot-center.controller';
import { BotCenterService } from './services/bot-center.service';

@Module({
  imports: [
    BotConfigurationModule,
    BotMemoryModule,
    DatabaseModule,
    WhatsappChannelModule,
    TypeOrmModule.forFeature([
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