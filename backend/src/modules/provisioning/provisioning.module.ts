import { Module } from '@nestjs/common';

import { EvolutionModule } from '../evolution/evolution.module';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [EvolutionModule],
  providers: [ProvisioningService],
  exports: [ProvisioningService],
})
export class ProvisioningModule {}
