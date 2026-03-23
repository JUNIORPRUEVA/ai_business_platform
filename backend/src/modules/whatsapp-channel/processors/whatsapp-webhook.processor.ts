import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { WhatsappWebhookJob, WhatsappWebhookService } from '../services/whatsapp-webhook.service';

const whatsappWebhookProcessingConcurrency = Math.max(
  Number.parseInt(process.env.WHATSAPP_WEBHOOK_PROCESSING_CONCURRENCY ?? '6', 10) || 6,
  1,
);

@Processor('whatsapp-webhook-processing', {
  concurrency: whatsappWebhookProcessingConcurrency,
})
export class WhatsappWebhookProcessor extends WorkerHost {
  constructor(private readonly webhookService: WhatsappWebhookService) {
    super();
  }

  async process(job: Job<WhatsappWebhookJob>): Promise<{ ok: true }> {
    await this.webhookService.processJob(job.data);
    return { ok: true };
  }
}
