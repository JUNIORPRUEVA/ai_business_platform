import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BotEntity } from './entities/bot.entity';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';

@Module({
  imports: [TypeOrmModule.forFeature([BotEntity])],
  controllers: [BotsController],
  providers: [BotsService],
  exports: [BotsService],
})
export class BotsModule {}
