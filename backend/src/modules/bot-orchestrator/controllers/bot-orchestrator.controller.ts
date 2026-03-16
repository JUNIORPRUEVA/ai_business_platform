import { Body, Controller, Post } from '@nestjs/common';

import { ProcessIncomingMessageDto } from '../dto/process-incoming-message.dto';
import { BotResponsePlan } from '../types/bot-orchestrator.types';
import { BotOrchestratorService } from '../services/bot-orchestrator.service';

@Controller('bot-orchestrator')
export class BotOrchestratorController {
  constructor(
    private readonly botOrchestratorService: BotOrchestratorService,
  ) {}

  @Post('process-incoming-message')
  async processIncomingMessage(
    @Body() payload: ProcessIncomingMessageDto,
  ): Promise<BotResponsePlan> {
    return this.botOrchestratorService.processIncomingMessage(payload);
  }
}