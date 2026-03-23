import { Module } from '@nestjs/common';

import { BillingModule } from '../billing/billing.module';
import { MediaUploadController } from './media-upload.controller';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [BillingModule],
  controllers: [StorageController, MediaUploadController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
