import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  Sse,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthUser } from '../../../common/auth/auth.types';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { CreateMemoryItemDto } from '../dto/create-memory-item.dto';
import { SendTestMediaDto } from '../dto/send-test-media.dto';
import { SendTestMessageDto } from '../dto/send-test-message.dto';
import { UpdateMemoryItemDto } from '../dto/update-memory-item.dto';
import { UpdatePromptDto } from '../dto/update-prompt.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenseGuard } from '../../billing/license.guard';
import {
  BotCenterOverviewResponse,
  BotContactContextResponse,
  BotConversationSummary,
  BotDeliveryDiagnosticsResponse,
  BotLogResponse,
  BotMemoryItemResponse,
  BotMemoryResponse,
  BotMessageResponse,
  BotPromptConfigResponse,
  BotStatusResponse,
  BotToolResponse,
  SendMediaMessageResponse,
  SendTestMessageResponse,
} from '../types/bot-center.types';
import { BotCenterService } from '../services/bot-center.service';

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Roles('admin', 'operator', 'viewer')
@Controller('bot-center')
export class BotCenterController {
  constructor(private readonly botCenterService: BotCenterService) {}

  @Get('overview')
  async getOverview(
    @CurrentUser() user: AuthUser,
    @Query('conversationId') conversationId?: string,
  ): Promise<BotCenterOverviewResponse> {
    return this.botCenterService.getOverview(user.companyId, conversationId);
  }

  @Get('conversations')
  getConversations(@CurrentUser() user: AuthUser): Promise<BotConversationSummary[]> {
    return this.botCenterService.listConversations(user.companyId);
  }

  @Sse('stream')
  streamRealtime(@CurrentUser() user: AuthUser): Observable<MessageEvent> {
    return this.botCenterService.streamRealtimeEvents(user.companyId);
  }

  @Get('conversations/:id/messages')
  getConversationMessages(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
  ): Promise<BotMessageResponse[]> {
    return this.botCenterService.getConversationMessages(user.companyId, conversationId);
  }

  @Get('conversations/:conversationId/messages/:messageId/media')
  async downloadMessageMedia(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ): Promise<StreamableFile> {
    const asset = await this.botCenterService.downloadMessageAsset(
      user.companyId,
      conversationId,
      messageId,
      'media',
    );

    response.setHeader('Content-Type', asset.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${asset.fileName}"`);
    response.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(asset.buffer);
  }

  @Get('conversations/:conversationId/messages/:messageId/thumbnail')
  async downloadMessageThumbnail(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ): Promise<StreamableFile> {
    const asset = await this.botCenterService.downloadMessageAsset(
      user.companyId,
      conversationId,
      messageId,
      'thumbnail',
    );

    response.setHeader('Content-Type', asset.contentType);
    response.setHeader('Content-Disposition', `inline; filename="${asset.fileName}"`);
    response.setHeader('Cache-Control', 'private, max-age=300');
    return new StreamableFile(asset.buffer);
  }

  @Get('conversations/:id/context')
  getConversationContext(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
  ): Promise<BotContactContextResponse> {
    return this.botCenterService.getConversationContext(user.companyId, conversationId);
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
  ): Promise<{ deleted: true }> {
    return this.botCenterService.deleteConversation(user.companyId, conversationId);
  }

  @Get('conversations/:id/delivery-diagnostics')
  getDeliveryDiagnostics(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
  ): Promise<BotDeliveryDiagnosticsResponse> {
    return this.botCenterService.getDeliveryDiagnostics(user.companyId, conversationId);
  }

  @Get('conversations/:id/memory')
  async getConversationMemory(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
  ): Promise<BotMemoryResponse> {
    return this.botCenterService.getConversationMemory(user.companyId, conversationId);
  }

  @Post('conversations/:id/memory')
  async createConversationMemory(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Body() payload: CreateMemoryItemDto,
  ): Promise<BotMemoryItemResponse> {
    return this.botCenterService.createConversationMemory(user.companyId, conversationId, payload);
  }

  @Patch('conversations/:conversationId/memory/:memoryId')
  async updateConversationMemory(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Param('memoryId') memoryId: string,
    @Body() payload: UpdateMemoryItemDto,
  ): Promise<BotMemoryItemResponse> {
    return this.botCenterService.updateConversationMemory(
      user.companyId,
      conversationId,
      memoryId,
      payload,
    );
  }

  @Delete('conversations/:conversationId/memory/:memoryId')
  async deleteConversationMemory(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Param('memoryId') memoryId: string,
  ): Promise<{ deleted: true }> {
    return this.botCenterService.deleteConversationMemory(user.companyId, conversationId, memoryId);
  }

  @Get('tools')
  getTools(): BotToolResponse[] {
    return this.botCenterService.listTools();
  }

  @Get('logs')
  getLogs(@CurrentUser() user: AuthUser): Promise<BotLogResponse[]> {
    return this.botCenterService.listLogs(user.companyId);
  }

  @Get('status')
  getStatus(@CurrentUser() user: AuthUser): Promise<BotStatusResponse> {
    return this.botCenterService.getStatus(user.companyId);
  }

  @Get('prompt')
  getPrompt(): BotPromptConfigResponse {
    return this.botCenterService.getPromptConfig();
  }

  @Put('prompt')
  async updatePrompt(@Body() payload: UpdatePromptDto): Promise<BotPromptConfigResponse> {
    return this.botCenterService.updatePromptConfig(payload);
  }

  @Post('test-message')
  async sendTestMessage(
    @CurrentUser() user: AuthUser,
    @Body() payload: SendTestMessageDto,
  ): Promise<SendTestMessageResponse> {
    return this.botCenterService.sendTestMessage(user.companyId, payload);
  }

  @Post('media-upload/:conversationId')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string },
    @Query('fileType') fileType = 'document',
  ): Promise<{ attachmentId: string; mimeType: string | null; fileName: string | null; duration: number | null }> {
    return this.botCenterService.uploadConversationMedia(user.companyId, conversationId, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileType,
    });
  }

  @Post('media-message')
  async sendMediaMessage(
    @CurrentUser() user: AuthUser,
    @Body() payload: SendTestMediaDto,
  ): Promise<SendMediaMessageResponse> {
    return this.botCenterService.sendMediaMessage(user.companyId, payload);
  }

  @Post('process-message')
  async processMessage(
    @CurrentUser() user: AuthUser,
    @Body() payload: SendTestMessageDto,
  ): Promise<{ ok: true; queued: false; messageId: string }> {
    return this.botCenterService.processDraftWithAi(user.companyId, payload);
  }
}
