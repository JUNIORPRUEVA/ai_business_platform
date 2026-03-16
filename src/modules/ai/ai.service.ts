import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigService) {}

  async draftReply(params: {
    model: string;
    temperature: number;
    systemPrompt: string;
    userMessage: string;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<{ content: string; provider: 'openai' | 'mock' }> {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY') ?? '';
    const apiUrl = this.configService.get<string>('OPENAI_API_URL') ?? 'https://api.openai.com/v1/chat/completions';

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return {
        provider: 'mock',
        content: 'Gracias por tu mensaje. Un asesor te responderá en breve.',
      };
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: params.systemPrompt },
    ];

    for (const item of params.history ?? []) {
      messages.push({ role: item.role, content: item.content });
    }

    messages.push({ role: 'user', content: params.userMessage });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        temperature: params.temperature,
        messages,
      }),
    });

    if (!response.ok) {
      return {
        provider: 'mock',
        content: 'Recibido. En este momento estoy teniendo dificultades para responder automáticamente.',
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    return {
      provider: 'openai',
      content: content && content.length > 0 ? content : 'Ok, entendido.',
    };
  }
}
