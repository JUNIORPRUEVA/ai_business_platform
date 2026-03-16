import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';

import { CreateMemoryItemDto } from '../dto/create-memory-item.dto';
import { SendTestMessageDto } from '../dto/send-test-message.dto';
import { UpdateMemoryItemDto } from '../dto/update-memory-item.dto';
import { UpdatePromptDto } from '../dto/update-prompt.dto';
import {
  BotCenterOverviewResponse,
  BotContactContextResponse,
  BotConversationSummary,
  BotLogResponse,
  BotMemoryItemResponse,
  BotMemoryResponse,
  BotMessageResponse,
  BotPromptConfigResponse,
  BotStatusResponse,
  BotToolResponse,
  SendTestMessageResponse,
} from '../types/bot-center.types';
import { BotCenterService } from '../services/bot-center.service';

@Controller('bot-center')
export class BotCenterController {
  constructor(private readonly botCenterService: BotCenterService) {}

  @Get('overview')
  async getOverview(
    @Query('conversationId') conversationId?: string,
  ): Promise<BotCenterOverviewResponse> {
    return this.botCenterService.getOverview(conversationId);
  }

  @Get('conversations')
  getConversations(): BotConversationSummary[] {
    return this.botCenterService.listConversations();
  }

  @Get('conversations/:id/messages')
  getConversationMessages(@Param('id') conversationId: string): BotMessageResponse[] {
    return this.botCenterService.getConversationMessages(conversationId);
  }

  @Get('conversations/:id/context')
  getConversationContext(@Param('id') conversationId: string): BotContactContextResponse {
    return this.botCenterService.getConversationContext(conversationId);
  }

  @Get('conversations/:id/memory')
  async getConversationMemory(@Param('id') conversationId: string): Promise<BotMemoryResponse> {
    return this.botCenterService.getConversationMemory(conversationId);
  }

  @Post('conversations/:id/memory')
  async createConversationMemory(
    @Param('id') conversationId: string,
    @Body() payload: CreateMemoryItemDto,
  ): Promise<BotMemoryItemResponse> {
    return this.botCenterService.createConversationMemory(conversationId, payload);
  }

  @Patch('conversations/:conversationId/memory/:memoryId')
  async updateConversationMemory(
    @Param('conversationId') conversationId: string,
    @Param('memoryId') memoryId: string,
    @Body() payload: UpdateMemoryItemDto,
  ): Promise<BotMemoryItemResponse> {
    return this.botCenterService.updateConversationMemory(
      conversationId,
      memoryId,
      payload,
    );
  }

  @Delete('conversations/:conversationId/memory/:memoryId')
  async deleteConversationMemory(
    @Param('conversationId') conversationId: string,
    @Param('memoryId') memoryId: string,
  ): Promise<{ deleted: true }> {
    return this.botCenterService.deleteConversationMemory(conversationId, memoryId);
  }

  @Get('tools')
  getTools(): BotToolResponse[] {
    return this.botCenterService.listTools();
  }

  @Get('logs')
  getLogs(): BotLogResponse[] {
    return this.botCenterService.listLogs();
  }

  @Get('status')
  getStatus(): BotStatusResponse {
    return this.botCenterService.getStatus();
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
  async sendTestMessage(@Body() payload: SendTestMessageDto): Promise<SendTestMessageResponse> {
    return this.botCenterService.sendTestMessage(payload);
  }
}