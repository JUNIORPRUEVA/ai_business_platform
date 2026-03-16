import { Module } from '@nestjs/common';

import { PersistenceModule } from '../../common/persistence/persistence.module';
import { BotConfigurationController } from './controllers/bot-configuration.controller';
import { BotConfigurationService } from './services/bot-configuration.service';

@Module({
  imports: [PersistenceModule],
  controllers: [BotConfigurationController],
  providers: [BotConfigurationService],
  exports: [BotConfigurationService],
})
export class BotConfigurationModule {}