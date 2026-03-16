import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { StorageService } from './storage.service';

class PresignDownloadQuery {
  @IsString()
  key!: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Roles('admin', 'operator')
  @Post('presign-upload')
  presignUpload(@CurrentUser() user: AuthUser, @Body() dto: PresignUploadDto) {
    return this.storageService.presignUpload({
      companyId: user.companyId,
      folder: dto.folder,
      filename: dto.filename,
      contentType: dto.contentType,
    });
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('presign-download')
  presignDownload(@CurrentUser() user: AuthUser, @Query() query: PresignDownloadQuery) {
    return this.storageService.presignDownload({
      companyId: user.companyId,
      key: query.key,
    });
  }
}
