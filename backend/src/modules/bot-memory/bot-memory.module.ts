import { Module } from '@nestjs/common';

import { PersistenceModule } from '../../common/persistence/persistence.module';
import { BotMemoryService } from './services/bot-memory.service';

@Module({
  imports: [PersistenceModule],
  providers: [BotMemoryService],
  exports: [BotMemoryService],
})
export class BotMemoryModule {}