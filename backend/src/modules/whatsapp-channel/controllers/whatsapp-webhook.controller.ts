import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import { WhatsappWebhookService } from '../services/whatsapp-webhook.service';

@Controller('api/webhooks/evolution')
export class WhatsappWebhookController {
  constructor(private readonly webhookService: WhatsappWebhookService) {}

  @Post(':companyId')
  handle(
    @Param('companyId', new ParseUUIDPipe()) companyId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.webhookService.enqueue(companyId, payload);
  }
}