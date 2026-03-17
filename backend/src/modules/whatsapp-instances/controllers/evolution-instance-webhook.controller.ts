import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EvolutionInstanceWebhookDto } from '../dto/evolution-instance-webhook.dto';
import { WhatsappInstancesService } from '../services/whatsapp-instances.service';

@Controller('webhook/evolution')
export class EvolutionInstanceWebhookController {
  constructor(
    private readonly whatsappInstancesService: WhatsappInstancesService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async handle(
    @Headers('x-webhook-token') webhookToken: string | undefined,
    @Body() payload: EvolutionInstanceWebhookDto,
  ) {
    const expected = (this.configService.get<string>('EVOLUTION_INSTANCE_WEBHOOK_TOKEN') ?? '').trim();
    if (expected && (webhookToken ?? '').trim() !== expected) {
      throw new ForbiddenException('Invalid webhook token.');
    }

    return this.whatsappInstancesService.applyWebhook(payload);
  }
}
