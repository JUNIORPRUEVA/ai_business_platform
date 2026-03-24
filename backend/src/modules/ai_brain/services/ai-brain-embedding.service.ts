import { Injectable, Logger } from '@nestjs/common';

import { OpenAiService } from '../../openai/services/openai.service';

@Injectable()
export class AiBrainEmbeddingService {
  private static readonly defaultEmbeddingModel = 'text-embedding-3-small';
  private readonly logger = new Logger(AiBrainEmbeddingService.name);

  constructor(private readonly openAiService: OpenAiService) {}

  async embedTexts(params: {
    companyId: string;
    texts: string[];
    model?: string;
  }): Promise<{ vectors: number[][]; provider: 'openai' | 'mock'; model: string }> {
    const normalizedTexts = params.texts
      .map((text) => text.replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 0);

    if (normalizedTexts.length === 0) {
      return {
        vectors: [],
        provider: 'mock',
        model: params.model ?? AiBrainEmbeddingService.defaultEmbeddingModel,
      };
    }

    const result = await this.openAiService.createEmbeddings({
      companyId: params.companyId,
      texts: normalizedTexts,
      model: params.model ?? AiBrainEmbeddingService.defaultEmbeddingModel,
    });

    this.logger.log(
      `[AI KNOWLEDGE] embeddings generated provider=${result.provider} model=${result.model} count=${result.vectors.length}`,
    );

    return result;
  }
}
