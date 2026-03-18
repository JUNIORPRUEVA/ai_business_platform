import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import {
  OpenAiChatMessage,
  OpenAiDraftRequest,
  OpenAiDraftResponse,
} from '../types/openai.types';

@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly botConfigurationService: BotConfigurationService,
  ) {}

  async draftResponse(
    request: OpenAiDraftRequest,
  ): Promise<OpenAiDraftResponse> {
    const configuration = this.botConfigurationService.getConfiguration();
    const model = request.model?.trim() || configuration.openai.model;
    const temperature = request.temperature ?? configuration.openai.temperature;
    const maxTokens = request.maxTokens ?? configuration.openai.maxTokens;
    const apiKey =
      configuration.openai.apiKey ||
      this.configService.get<string>('OPENAI_API_KEY') ||
      '';
    const messages = this.buildMessages(request);
    const systemPrompt =
      messages.find((message) => message.role === 'system')?.content ??
      this.buildSystemPrompt(request.systemPrompt, request.memoryContext);

    if (!this.hasUsableCredentials(apiKey) || !configuration.openai.isEnabled) {
      return this.buildMockDraft(model, systemPrompt, request);
    }

    const timeoutMs = request.timeoutMs ?? 30000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        this.configService.get<string>('OPENAI_API_URL') ??
          'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature,
            max_tokens: maxTokens,
            messages,
          }),
        },
      );

      if (!response.ok) {
        this.logger.warn(`OpenAI request failed status=${response.status} model=${model}`);
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
    } catch (error) {
      this.logger.warn(
        `OpenAI request exception model=${model} reason=${error instanceof Error ? error.message : 'unknown'}`,
      );
      return this.buildMockDraft(model, systemPrompt, request);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  buildSystemPrompt(basePrompt?: string, memoryContext?: string): string {
    const prompt = basePrompt?.trim() || 'Eres un asistente empresarial profesional.';
    const context = memoryContext?.trim();
    return context ? `${prompt}\n\nMemory context:\n${context}` : prompt;
  }

  private hasUsableCredentials(apiKey: string): boolean {
    return Boolean(apiKey && !apiKey.includes('*') && apiKey.startsWith('sk-'));
  }

  private buildMockDraft(
    model: string,
    systemPrompt: string,
    request: OpenAiDraftRequest,
  ): OpenAiDraftResponse {
    const sender = request.senderName?.trim() || 'cliente';
    const intent = request.detectedIntent?.trim() || 'consulta';

    return {
      provider: 'mock',
      model,
      content:
        `Hola ${sender}. Recibimos tu ${intent} y la estamos procesando en este momento. ` +
        'Si necesitas una respuesta inmediata con datos exactos, un asesor puede continuar la conversación.',
      usedMockFallback: true,
      systemPrompt,
    };
  }

  private buildMessages(request: OpenAiDraftRequest): OpenAiChatMessage[] {
    if (request.messages && request.messages.length > 0) {
      return request.messages;
    }

    return [
      {
        role: 'system',
        content: this.buildSystemPrompt(request.systemPrompt, request.memoryContext),
      },
      {
        role: 'user',
        content: request.message?.trim() || '',
      },
    ];
  }
}