import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { WhatsappWebhookJob, WhatsappWebhookService } from '../services/whatsapp-webhook.service';

@Processor('whatsapp-webhook-processing')
export class WhatsappWebhookProcessor extends WorkerHost {
  constructor(private readonly webhookService: WhatsappWebhookService) {
    super();
  }

  async process(job: Job<WhatsappWebhookJob>): Promise<{ ok: true }> {
    await this.webhookService.processJob(job.data);
    return { ok: true };
  }
}