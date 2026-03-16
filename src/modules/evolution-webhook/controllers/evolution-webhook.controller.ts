import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';

import { EvolutionMessageWebhookDto } from '../dto/evolution-message-webhook.dto';
import { EvolutionWebhookService } from '../services/evolution-webhook.service';

class EvolutionWebhookParams {
  @IsUUID()
  channelId!: string;
}

@Controller('webhooks/evolution')
export class EvolutionWebhookController {
  constructor(
    private readonly evolutionWebhookService: EvolutionWebhookService,
  ) {}

  @Post(':channelId/messages')
  processMessages(
    @Param() params: EvolutionWebhookParams,
    @Headers('x-webhook-token') webhookToken: string | undefined,
    @Body() payload: EvolutionMessageWebhookDto,
  ) {
    return this.evolutionWebhookService.processIncomingMessage({
      channelId: params.channelId,
      webhookToken,
      payload,
    });
  }
}