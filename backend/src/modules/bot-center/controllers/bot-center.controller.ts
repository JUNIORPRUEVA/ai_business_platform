import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';

import { SendTestMessageDto } from '../dto/send-test-message.dto';
import { UpdatePromptDto } from '../dto/update-prompt.dto';
import {
  BotCenterOverviewResponse,
  BotContactContextResponse,
  BotConversationSummary,
  BotLogResponse,
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