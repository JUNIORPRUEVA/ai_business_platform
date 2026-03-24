import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';

import { AiBrainKnowledgeIndexingService } from '../services/ai-brain-knowledge-indexing.service';
import { KnowledgeIndexingJob } from '../types/knowledge-indexing.types';

const knowledgeIndexingConcurrency = Math.max(
  Number.parseInt(process.env.KNOWLEDGE_INDEXING_CONCURRENCY ?? '2', 10) || 2,
  1,
);

@Processor('knowledge-indexing', { concurrency: knowledgeIndexingConcurrency })
export class KnowledgeIndexingProcessor extends WorkerHost {
  constructor(
    private readonly knowledgeIndexingService: AiBrainKnowledgeIndexingService,
  ) {
    super();
  }

  async process(job: Job<KnowledgeIndexingJob>): Promise<{ ok: true }> {
    await this.knowledgeIndexingService.indexDocument(job.data);
    return { ok: true };
  }
}
