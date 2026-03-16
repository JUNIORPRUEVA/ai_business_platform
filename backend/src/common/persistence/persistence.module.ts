import { Module } from '@nestjs/common';

import { JsonFileStoreService } from './json-file-store.service';

@Module({
  providers: [JsonFileStoreService],
  exports: [JsonFileStoreService],
})
export class PersistenceModule {}