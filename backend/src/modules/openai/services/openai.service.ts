import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { OpenAiDraftRequest, OpenAiDraftResponse } from '../types/openai.types';

@Injectable()
export class OpenAiService {
  constructor(
    private readonly configService: ConfigService,
    private readonly botConfigurationService: BotConfigurationService,
  ) {}

  async draftResponse(
    request: OpenAiDraftRequest,
  ): Promise<OpenAiDraftResponse> {
    const configuration = this.botConfigurationService.getConfiguration();
    const model = configuration.openai.model;
    const apiKey =
      configuration.openai.apiKey ||
      this.configService.get<string>('OPENAI_API_KEY') ||
      '';
    const systemPrompt = this.buildSystemPrompt(request.systemPrompt, request.memoryContext);

    if (!this.hasUsableCredentials(apiKey) || !configuration.openai.isEnabled) {
      return this.buildMockDraft(model, systemPrompt, request);
    }

    try {
      const response = await fetch(
        this.configService.get<string>('OPENAI_API_URL') ??
          'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: configuration.openai.temperature,
            max_tokens: configuration.openai.maxTokens,
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: request.message,
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        return this.buildMockDraft(model, systemPrompt, request);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content =
        data.choices?.[0]?.message?.content?.trim() ||
        this.buildMockDraft(model, systemPrompt, request).content;

      return {
        provider: 'openai',
        model,
        content,
        usedMockFallback: false,
        systemPrompt,
      };
    } catch {
      return this.buildMockDraft(model, systemPrompt, request);
    }
  }

  buildSystemPrompt(basePrompt: string, memoryContext: string): string {
    return `${basePrompt}\n\nMemory context:\n${memoryContext}`;
  }

  private hasUsableCredentials(apiKey: string): boolean {
    return Boolean(apiKey && !apiKey.includes('*') && apiKey.startsWith('sk-'));
  }

  private buildMockDraft(
    model: string,
    systemPrompt: string,
    request: OpenAiDraftRequest,
  ): OpenAiDraftResponse {
    const sender = request.senderName?.trim() || 'customer';

    return {
      provider: 'mock',
      model,
      content:
        `Draft a concise reply for ${sender} about ${request.detectedIntent}. ` +
        'Use the stored memory context, answer only with verified product and policy information, and escalate if certainty is low.',
      usedMockFallback: true,
      systemPrompt,
    };
  }
}