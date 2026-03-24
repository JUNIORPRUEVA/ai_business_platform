import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { AuthUser } from '../../common/auth/auth.types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenseGuard } from '../billing/license.guard';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVideoDto } from './dto/create-product-video.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

class IdParam {
  @IsUUID()
  id!: string;
}

class NestedMediaParam extends IdParam {
  @IsUUID()
  mediaId!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles('admin', 'operator', 'viewer')
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.productsService.list(user.companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query('q') query = '') {
    return this.productsService.search(user.companyId, query);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.productsService.get(user.companyId, params.id);
  }

  @Roles('admin', 'operator')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.companyId, dto);
  }

  @Roles('admin', 'operator')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param() params: IdParam, @Body() dto: UpdateProductDto) {
    return this.productsService.update(user.companyId, params.id, dto);
  }

  @Roles('admin', 'operator')
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.productsService.remove(user.companyId, params.id);
  }

  @Roles('admin', 'operator')
  @Post('import')
  import(@CurrentUser() user: AuthUser, @Body() dto: ImportProductsDto) {
    return this.productsService.import(user.companyId, dto);
  }

  @Roles('admin', 'operator')
  @Post('media/presign-upload')
  presignMediaUpload(
    @CurrentUser() user: AuthUser,
    @Body() payload: { filename: string; contentType?: string | null },
  ) {
    return this.productsService.presignMediaUpload({
      companyId: user.companyId,
      filename: payload.filename,
      contentType: payload.contentType ?? null,
    });
  }

  @Roles('admin', 'operator')
  @Post(':id/images')
  addImage(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParam,
    @Body() dto: CreateProductImageDto,
  ) {
    return this.productsService.addImage(user.companyId, params.id, dto);
  }

  @Roles('admin', 'operator')
  @Delete(':id/images/:mediaId')
  removeImage(@CurrentUser() user: AuthUser, @Param() params: NestedMediaParam) {
    return this.productsService.removeImage(user.companyId, params.id, params.mediaId);
  }

  @Roles('admin', 'operator')
  @Post(':id/videos')
  addVideo(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParam,
    @Body() dto: CreateProductVideoDto,
  ) {
    return this.productsService.addVideo(user.companyId, params.id, dto);
  }

  @Roles('admin', 'operator')
  @Delete(':id/videos/:mediaId')
  removeVideo(@CurrentUser() user: AuthUser, @Param() params: NestedMediaParam) {
    return this.productsService.removeVideo(user.companyId, params.id, params.mediaId);
  }
}
