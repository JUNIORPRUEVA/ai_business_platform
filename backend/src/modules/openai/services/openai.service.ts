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
    const runtime = this.botConfigurationService.getResolvedOpenAiRuntimeSettings({
      model: request.model,
    });
    const model = runtime.model;
    const temperature = request.temperature ?? configuration.openai.temperature;
    const maxTokens = request.maxTokens ?? configuration.openai.maxTokens;
    const apiKey = runtime.apiKey;
    const messages = this.buildMessages(request);
    const systemPrompt =
      messages.find((message) => message.role === 'system')?.content ??
      this.buildSystemPrompt(request.systemPrompt, request.memoryContext);

    if (!this.hasUsableCredentials(apiKey) || !runtime.runtimeEnabled) {
      this.logger.warn(
        `OpenAI mock fallback enabled reason=${!runtime.runtimeEnabled ? 'openai_disabled' : 'missing_or_invalid_api_key'} model=${model} source=${runtime.source}`,
      );
      return this.buildMockDraft(model, systemPrompt, request);
    }

    const timeoutMs = request.timeoutMs ?? 30000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        runtime.apiUrl,
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
    const lastUserMessage = this.extractLastUserMessage(request);
    const previousTopic = this.extractPreviousUserTopic(request, lastUserMessage);
    const normalized = lastUserMessage.toLowerCase();

    let content =
      `Hola ${sender}. Recibimos tu ${intent} y la estamos procesando en este momento. ` +
      'Si necesitas una respuesta inmediata con datos exactos, un asesor puede continuar la conversación.';

    if (this.isGreeting(normalized)) {
      content = previousTopic
        ? `Hola ${sender}. Aqui sigo contigo. La última vez estábamos hablando de ${previousTopic}. ¿Qué necesitas resolver ahora mismo?`
        : `Hola ${sender}. Estoy aquí para ayudarte. ¿Qué necesitas hoy?`;
    } else if (this.isHowAreYou(normalized)) {
      content = previousTopic
        ? `Estoy listo para seguir ayudándote. Seguíamos con ${previousTopic}. ¿Quieres que retomemos eso o tienes otra consulta?`
        : 'Estoy bien y listo para ayudarte. ¿Qué necesitas resolver ahora mismo?';
    } else if (normalized.length <= 12) {
      content = previousTopic
        ? `Te sigo el hilo con ${previousTopic}. Cuéntame un poco más para ayudarte mejor.`
        : `Claro, ${sender}. Cuéntame un poco más y te ayudo enseguida.`;
    } else if (previousTopic) {
      content = `Entiendo. Para seguir con ${previousTopic}, esto es lo que puedo adelantarte: ${this.summarizeForMock(lastUserMessage)}`;
    } else {
      content = `Entiendo, ${sender}. ${this.summarizeForMock(lastUserMessage)}`;
    }

    return {
      provider: 'mock',
      model,
      content,
      usedMockFallback: true,
      systemPrompt,
    };
  }

  private extractLastUserMessage(request: OpenAiDraftRequest): string {
    const fromMessages = [...(request.messages ?? [])]
      .reverse()
      .find((message) => message.role === 'user' && message.content.trim().length > 0)?.content;

    return fromMessages?.trim() || request.message?.trim() || '';
  }

  private extractPreviousUserTopic(request: OpenAiDraftRequest, lastUserMessage: string): string | null {
    const previousUserMessages = (request.messages ?? [])
      .filter((message) => message.role === 'user')
      .map((message) => message.content.trim())
      .filter((message) => message.length > 0 && message !== lastUserMessage);

    const previous = previousUserMessages[previousUserMessages.length - 1] ?? '';
    if (!previous) {
      return null;
    }

    const cleaned = previous.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 4) {
      return null;
    }

    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
  }

  private isGreeting(value: string): boolean {
    return /^(hola|hola\b|buenas|buenos d[ií]as|buenas tardes|buenas noches|hey|ey)\b/.test(value);
  }

  private isHowAreYou(value: string): boolean {
    return /(como estas|c[oó]mo est[aá]s|que tal|q tal|todo bien)/.test(value);
  }

  private summarizeForMock(message: string): string {
    const cleaned = message.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return 'Cuéntame un poco más y te ayudo.';
    }
    if (cleaned.length <= 120) {
      return `Te ayudo con esto: "${cleaned}". Si quieres, dime un poco más de contexto y sigo contigo.`;
    }
    return `Te ayudo con esto: "${cleaned.slice(0, 117)}...". Si quieres, dime un poco más de contexto y sigo contigo.`;
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