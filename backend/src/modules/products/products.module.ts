import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BillingModule } from '../billing/billing.module';
import { StorageModule } from '../storage/storage.module';
import { ProductImageEntity } from './entities/product-image.entity';
import { ProductEntity } from './entities/product.entity';
import { ProductVideoEntity } from './entities/product-video.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, ProductImageEntity, ProductVideoEntity]),
    BillingModule,
    StorageModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
