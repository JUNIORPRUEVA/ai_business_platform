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
  private static readonly defaultTemperature = 0.7;
  private static readonly defaultPresencePenalty = 0.6;
  private static readonly defaultFrequencyPenalty = 0.4;
  private readonly logger = new Logger(OpenAiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly botConfigurationService: BotConfigurationService,
  ) {}

  async transcribeAudio(params: {
    companyId: string;
    buffer: Buffer;
    filename: string;
    contentType?: string | null;
    model?: string;
    timeoutMs?: number;
  }): Promise<{ text: string; provider: 'openai' | 'mock'; model: string }> {
    const model = params.model ?? 'gpt-4o-mini-transcribe';
    const runtime = await this.botConfigurationService.getResolvedOpenAiRuntimeSettings(
      params.companyId,
      { model },
    );

    if (!this.hasUsableCredentials(runtime.apiKey) || !runtime.runtimeEnabled) {
      return { text: '', provider: 'mock', model };
    }

    const timeoutMs = params.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const form = new FormData();
      form.append(
        'file',
        new Blob([Uint8Array.from(params.buffer)], {
          type: params.contentType?.trim() || 'audio/wav',
        }),
        params.filename,
      );
      form.append('model', model);

      const response = await fetch(this.resolveAudioTranscriptionUrl(runtime.apiUrl), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${runtime.apiKey}`,
        },
        body: form,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `OpenAI transcription failed status=${response.status} detail=${detail.slice(0, 300)}`,
        );
      }

      const data = (await response.json()) as { text?: string };
      return {
        text: data.text?.trim() ?? '',
        provider: 'openai',
        model,
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  async draftResponse(
    request: OpenAiDraftRequest,
  ): Promise<OpenAiDraftResponse> {
    const configuration = request.companyId
      ? await this.botConfigurationService.getConfiguration(request.companyId)
      : this.botConfigurationService.getDefaultConfiguration();
    const runtime = await this.botConfigurationService.getResolvedOpenAiRuntimeSettings(
      request.companyId,
      {
      model: request.model,
      },
    );
    const model = runtime.model;
    const temperature = request.temperature ?? configuration.openai.temperature ?? OpenAiService.defaultTemperature;
    const presencePenalty = request.presencePenalty ?? OpenAiService.defaultPresencePenalty;
    const frequencyPenalty = request.frequencyPenalty ?? OpenAiService.defaultFrequencyPenalty;
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
            presence_penalty: presencePenalty,
            frequency_penalty: frequencyPenalty,
            max_completion_tokens: maxTokens,
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

  private resolveAudioTranscriptionUrl(chatApiUrl: string): string {
    const trimmed = chatApiUrl.trim();
    if (!trimmed) {
      return 'https://api.openai.com/v1/audio/transcriptions';
    }

    if (trimmed.endsWith('/chat/completions')) {
      return `${trimmed.slice(0, -'/chat/completions'.length)}/audio/transcriptions`;
    }

    if (trimmed.endsWith('/v1')) {
      return `${trimmed}/audio/transcriptions`;
    }

    return 'https://api.openai.com/v1/audio/transcriptions';
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

    let content = this.selectVariant(`${sender}:${normalized}:${intent}`, [
      `Perfecto, ${sender}. Estoy aquí para ayudarte con eso. Si quieres, te muestro opciones o te doy una recomendación directa.`,
      `Claro, ${sender}. Vamos a resolverlo juntos. Puedo enseñarte opciones, precios o el siguiente paso según lo que necesites.`,
    ]);

    if (this.isGreeting(normalized)) {
      content = previousTopic
        ? this.selectVariant(previousTopic, [
            `Hola ${sender} 👋 Seguimos con ${previousTopic}. ¿Quieres que te muestre opciones, precios o disponibilidad?`,
            `Hola ${sender} 👋 Te sigo el hilo con ${previousTopic}. Dime si prefieres precios, opciones o una recomendación rápida.`,
          ])
        : this.selectVariant(sender, [
            `Hola ${sender} 👋 ¿Qué estás buscando hoy? Tengo varias opciones que podrían interesarte.`,
            `Hola ${sender} 👋 Cuéntame qué necesitas y te ayudo a encontrar la mejor opción.`,
          ]);
    } else if (this.isHowAreYou(normalized)) {
      content = previousTopic
        ? `Todo bien por aquí 👍 Seguimos con ${previousTopic}. ¿Quieres que avancemos con opciones o con precios?`
        : 'Todo bien 👍 Dime qué necesitas y te ayudo de una vez.';
    } else if (this.isAffirmative(normalized)) {
      content = previousTopic
        ? `Perfecto 👍 Sobre ${previousTopic}, ¿prefieres que te muestre precios o las opciones disponibles primero?`
        : 'Perfecto 👍 ¿Quieres que te muestre precios o prefieres ver opciones primero?';
    } else if (normalized.length <= 12) {
      content = previousTopic
        ? `Seguimos con ${previousTopic}. Te puedo mostrar opciones, precios o disponibilidad, como prefieras.`
        : this.selectVariant(normalized, [
            'Claro 👍 Te puedo mostrar opciones, precios o disponibilidad. ¿Por cuál quieres empezar?',
            'Perfecto 👍 Vamos rápido: dime si quieres ver opciones, precios o una recomendación.',
          ]);
    } else if (previousTopic) {
      content = `Entiendo. Para seguir con ${previousTopic}, ${this.summarizeForMock(lastUserMessage)}`;
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

  private isAffirmative(value: string): boolean {
    return /^(si|sí|ok|oki|dale|perfecto|de acuerdo|claro|yes)\b/.test(value.trim());
  }

  private selectVariant(seed: string, variants: string[]): string {
    const hash = Array.from(seed).reduce((total, char, index) => total + (char.charCodeAt(0) * (index + 1)), 0);
    return variants[Math.abs(hash) % variants.length];
  }

  private summarizeForMock(message: string): string {
    const cleaned = message.replace(/\s+/g, ' ').trim();
    if (!cleaned) {
      return 'te ayudo enseguida. Si quieres, te muestro opciones o te recomiendo lo más conveniente.';
    }
    if (cleaned.length <= 120) {
      return `te ayudo con esto: "${cleaned}". Si quieres, te doy opciones, precios o una recomendación puntual.`;
    }
    return `te ayudo con esto: "${cleaned.slice(0, 117)}...". Si quieres, te doy opciones, precios o una recomendación puntual.`;
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
