import { Module } from '@nestjs/common';

import { EvolutionController } from './evolution.controller';
import { EvolutionService } from './evolution.service';

@Module({
  controllers: [EvolutionController],
  providers: [EvolutionService],
  exports: [EvolutionService],
})
export class EvolutionModule {}
