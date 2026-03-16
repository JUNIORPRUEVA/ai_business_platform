import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { AuthUser } from '../../../common/auth/auth.types';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LicenseGuard } from '../../billing/license.guard';
import { MessagesService } from '../../messages/messages.service';
import { PresignBrainDocumentUploadDto } from '../dto/presign-brain-document-upload.dto';
import { ProcessAiMessageDto } from '../dto/process-ai-message.dto';
import { RegisterKnowledgeDocumentDto } from '../dto/register-knowledge-document.dto';
import { UpdateKnowledgeDocumentDto } from '../dto/update-knowledge-document.dto';
import { AiBrainDocumentService } from '../services/ai-brain-document.service';
import { AiBrainService } from '../services/ai-brain.service';

class IdParam {
  @IsUUID()
  id!: string;
}

class LogsQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@UseGuards(JwtAuthGuard, RolesGuard, LicenseGuard)
@Controller('ai-brain')
export class AiBrainController {
  constructor(
    private readonly aiBrainService: AiBrainService,
    private readonly aiBrainDocumentService: AiBrainDocumentService,
    private readonly messagesService: MessagesService,
  ) {}

  @Roles('admin', 'operator', 'viewer')
  @Get('logs')
  listLogs(@CurrentUser() user: AuthUser, @Query() query: LogsQuery) {
    return this.aiBrainService.listLogs(user.companyId, query.limit);
  }

  @Roles('admin', 'operator', 'viewer')
  @Get('documents')
  listDocuments(@CurrentUser() user: AuthUser) {
    return this.aiBrainDocumentService.list(user.companyId);
  }

  @Roles('admin', 'operator')
  @Post('documents/presign-upload')
  presignDocumentUpload(
    @CurrentUser() user: AuthUser,
    @Body() dto: PresignBrainDocumentUploadDto,
  ) {
    return this.aiBrainDocumentService.createUploadTarget({
      companyId: user.companyId,
      filename: dto.filename,
      contentType: dto.contentType,
      botId: dto.botId,
    });
  }

  @Roles('admin', 'operator')
  @Post('documents')
  registerDocument(@CurrentUser() user: AuthUser, @Body() dto: RegisterKnowledgeDocumentDto) {
    return this.aiBrainDocumentService.create(user.companyId, dto);
  }

  @Roles('admin', 'operator')
  @Patch('documents/:id')
  updateDocument(
    @CurrentUser() user: AuthUser,
    @Param() params: IdParam,
    @Body() dto: UpdateKnowledgeDocumentDto,
  ) {
    return this.aiBrainDocumentService.update(user.companyId, params.id, dto);
  }

  @Roles('admin', 'operator')
  @Delete('documents/:id')
  removeDocument(@CurrentUser() user: AuthUser, @Param() params: IdParam) {
    return this.aiBrainDocumentService.remove(user.companyId, params.id);
  }

  @Roles('admin', 'operator')
  @Post('process-message')
  async processMessage(@CurrentUser() user: AuthUser, @Body() dto: ProcessAiMessageDto) {
    const createdMessage = await this.messagesService.create(
      user.companyId,
      dto.conversationId,
      {
        sender: 'client',
        content: dto.message,
        type: 'text',
        metadata: {
          source: 'manual-ai-brain-process',
        },
      },
    );

    await this.aiBrainService.processInboundMessage({
      companyId: user.companyId,
      channelId: dto.channelId,
      conversationId: dto.conversationId,
      contactPhone: dto.contactPhone ?? '',
      messageId: createdMessage.id,
    });

    return { ok: true, queued: false, messageId: createdMessage.id };
  }
}