import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PersistenceModule } from '../../common/persistence/persistence.module';
import { ChannelsModule } from '../channels/channels.module';
import { BotConfigurationController } from './controllers/bot-configuration.controller';
import { BotConfigurationEntity } from './entities/bot-configuration.entity';
import { BotConfigurationService } from './services/bot-configuration.service';

@Module({
  imports: [
    PersistenceModule,
    ChannelsModule,
    TypeOrmModule.forFeature([BotConfigurationEntity]),
  ],
  controllers: [BotConfigurationController],
  providers: [BotConfigurationService],
  exports: [BotConfigurationService],
})
export class BotConfigurationModule {}