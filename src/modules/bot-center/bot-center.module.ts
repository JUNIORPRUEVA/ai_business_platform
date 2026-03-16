import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { BotConfigurationModule } from '../bot-configuration/bot-configuration.module';
import { BotMemoryModule } from '../bot-memory/bot-memory.module';
import { BotCenterController } from './controllers/bot-center.controller';
import { BotCenterService } from './services/bot-center.service';

@Module({
  imports: [BotConfigurationModule, BotMemoryModule, DatabaseModule],
  controllers: [BotCenterController],
  providers: [BotCenterService],
  exports: [BotCenterService],
})
export class BotCenterModule {}