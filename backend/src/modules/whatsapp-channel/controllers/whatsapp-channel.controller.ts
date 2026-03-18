import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { AuthUser } from '../../../common/auth/auth.types';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenseGuard } from '../../billing/license.guard';
import { ConfigureWhatsappWebhookDto } from '../dto/configure-whatsapp-webhook.dto';
import { SaveWhatsappChannelConfigDto } from '../dto/save-whatsapp-channel-config.dto';
import { SendWhatsappAudioDto } from '../dto/send-whatsapp-audio.dto';
import { SendWhatsappMediaDto } from '../dto/send-whatsapp-media.dto';
import { SendWhatsappTextDto } from '../dto/send-whatsapp-text.dto';
import { WhatsappAttachmentService } from '../services/whatsapp-attachment.service';
import { WhatsappChannelConfigService } from '../services/whatsapp-channel-config.service';
import { WhatsappChannelLogService } from '../services/whatsapp-channel-log.service';
import { WhatsappMessagingService } from '../services/whatsapp-messaging.service';

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('api/channels/whatsapp')
export class WhatsappChannelController {
  constructor(
    private readonly configService: WhatsappChannelConfigService,
    private readonly messagingService: WhatsappMessagingService,
    private readonly attachmentsService: WhatsappAttachmentService,
    private readonly logsService: WhatsappChannelLogService,
  ) {}

  @Roles('admin', 'operator')
  @Post(':companyId')
  create(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() payload: SaveWhatsappChannelConfigDto,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.create(companyId, payload);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.get(companyId);
  }

  @Roles('admin', 'operator')
  @Put(':companyId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() payload: SaveWhatsappChannelConfigDto,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.update(companyId, payload);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/test-connection')
  testConnection(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.testConnection(companyId);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/webhook/configure')
  configureWebhook(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() payload: ConfigureWhatsappWebhookDto,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.configureWebhook(companyId, payload);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/webhook/sync')
  syncWebhook(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.syncWebhook(companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId/webhook')
  getWebhook(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.getWebhook(companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId/status')
  getStatus(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.getStatus(companyId);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/sync-instance')
  syncInstance(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.syncInstance(companyId);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/disconnect')
  disconnect(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.disconnect(companyId);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/reconnect')
  reconnect(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.configService.reconnect(companyId);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/messages/text')
  sendText(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() payload: SendWhatsappTextDto,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.messagingService.sendText(companyId, payload);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/messages/media')
  sendMedia(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() payload: SendWhatsappMediaDto,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.messagingService.sendMedia(companyId, payload);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/messages/audio')
  sendAudio(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() payload: SendWhatsappAudioDto,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.messagingService.sendAudio(companyId, payload);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId/chats')
  listChats(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.messagingService.listChats(companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId/chats/:remoteJid/messages')
  listMessages(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('remoteJid') remoteJid: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.messagingService.listMessages(companyId, decodeURIComponent(remoteJid));
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId/messages/:messageId')
  getMessage(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.messagingService.getMessage(companyId, messageId);
  }

  @Roles('admin', 'operator')
  @Post(':companyId/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Query('fileType') fileType = 'document',
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.attachmentsService.uploadManual({
      companyId,
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileType,
    });
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId/media/:attachmentId')
  getMedia(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.attachmentsService.getDownload(companyId, attachmentId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId/logs')
  logs(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.logsService.list(companyId);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get(':companyId/webhook-events')
  webhookEvents(
    @CurrentUser() user: AuthUser,
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
  ) {
    this.configService.assertCompanyAccess(user.companyId, companyId);
    return this.logsService.list(companyId);
  }
}