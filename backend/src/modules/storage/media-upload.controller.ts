import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthUser } from '../../common/auth/auth.types';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LicenseGuard } from '../billing/license.guard';
import { StorageService } from './storage.service';

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('upload')
export class MediaUploadController {
  constructor(private readonly storageService: StorageService) {}

  @Roles('admin', 'operator')
  @Post('media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ url: string; key: string; fileName: string; mimeType: string | null }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No se recibió un archivo válido.');
    }

    const uploaded = await this.storageService.uploadBuffer({
      companyId: user.companyId,
      folder: 'media',
      filename: file.originalname,
      contentType: file.mimetype || undefined,
      contentDisposition: 'inline',
      buffer: file.buffer,
    });

    const signed = await this.storageService.presignDownload({
      companyId: user.companyId,
      key: uploaded.key,
      expiresInSeconds: 60 * 60 * 24,
    });

    return {
      url: signed.url,
      key: uploaded.key,
      fileName: file.originalname,
      mimeType: file.mimetype || null,
    };
  }
}
