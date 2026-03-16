import { BadRequestException, Body, Controller, Headers, Post } from '@nestjs/common';

import { ChannelsService } from '../../channels/channels.service';
import { EvolutionMessageWebhookDto } from '../dto/evolution-message-webhook.dto';
import { EvolutionWebhookService } from '../services/evolution-webhook.service';

@Controller('webhook/whatsapp')
export class WhatsappWebhookController {
  constructor(
    private readonly evolutionWebhookService: EvolutionWebhookService,
    private readonly channelsService: ChannelsService,
  ) {}

  @Post()
  async processMessages(
    @Headers('x-channel-id') channelIdHeader: string | undefined,
    @Headers('x-webhook-token') webhookToken: string | undefined,
    @Body() payload: EvolutionMessageWebhookDto,
  ) {
    const channelId = channelIdHeader?.trim();
    const instanceName = payload.instance?.trim();

    if (!channelId && !instanceName) {
      throw new BadRequestException(
        'Missing channel reference. Provide x-channel-id header or payload.instance.',
      );
    }

    const channel = channelId
      ? await this.channelsService.getByIdUnsafe(channelId)
      : await this.channelsService.getByInstanceNameUnsafe(instanceName as string);

    return this.evolutionWebhookService.processIncomingMessage({
      channelId: channel.id,
      webhookToken,
      payload,
    });
  }
}