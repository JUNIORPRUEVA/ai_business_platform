import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { AiBrainService } from '../../ai_brain/services/ai-brain.service';

export interface MessageProcessingJob {
  companyId: string;
  channelId: string;
  contactPhone: string;
  remoteJid?: string;
  conversationId: string;
  messageId: string;
}

@Processor('message-processing')
export class MessageProcessingProcessor extends WorkerHost {
  constructor(
    private readonly aiBrainService: AiBrainService,
  ) {
    super();
  }

  async process(job: Job<MessageProcessingJob>): Promise<{ ok: true }> {
    await this.aiBrainService.processInboundMessage(job.data);
    return { ok: true };
  }
}
