import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { BotEngineService } from '../../ai-engine/bot-engine.service';

export interface MessageProcessingJob {
  companyId: string;
  channelId: string;
  contactPhone: string;
  conversationId: string;
  messageId: string;
}

@Processor('message-processing')
export class MessageProcessingProcessor extends WorkerHost {
  constructor(
    private readonly botEngineService: BotEngineService,
  ) {
    super();
  }

  async process(job: Job<MessageProcessingJob>): Promise<{ ok: true }> {
    await this.botEngineService.processInboundMessage(job.data);
    return { ok: true };
  }
}
