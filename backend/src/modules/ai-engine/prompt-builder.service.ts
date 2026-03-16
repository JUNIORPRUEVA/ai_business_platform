import { Injectable } from '@nestjs/common';

import { BotEntity } from '../bots/entities/bot.entity';
import { CompanyEntity } from '../companies/entities/company.entity';
import { ConversationMemoryEntity } from './entities/conversation-memory.entity';

@Injectable()
export class PromptBuilderService {
  buildSystemPrompt(params: {
    company: CompanyEntity;
    bot: BotEntity;
    baseSystemPrompt: string;
    contactMemory: Record<string, string>;
  }): string {
    const contactMemoryLines = Object.entries(params.contactMemory)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');

    const language = params.bot.language || 'es';
    const botSystemPrompt = params.bot.systemPrompt;

    return [
      params.baseSystemPrompt?.trim() || 'Eres un asistente empresarial profesional.',
      '',
      'Información de la empresa:',
      `- Nombre: ${params.company.name}`,
      '',
      'Configuración del bot:',
      `- Nombre: ${params.bot.name}`,
      `- Idioma: ${language}`,
      botSystemPrompt ? `- Prompt del bot: ${botSystemPrompt}` : '',
      '',
      'Memoria del cliente (facts):',
      contactMemoryLines || '- (sin datos)',
      '',
      'Reglas de herramientas (tools):',
      'Si necesitas ejecutar una herramienta, responde ÚNICAMENTE con un JSON válido con la forma:',
      '{"tool":"<tool_name>","data":{...}}',
      'Sin texto adicional. Si NO necesitas herramienta, responde normalmente.',
      '',
      'Reglas de estilo:',
      '- Sé claro y profesional.',
      '- No inventes datos; si falta información, pregunta.',
    ].join('\n');
  }

  buildMessages(params: {
    systemPrompt: string;
    history: ConversationMemoryEntity[];
    userMessage: string;
  }): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: params.systemPrompt },
    ];

    for (const item of params.history) {
      if (item.role === 'system') {
        continue;
      }
      messages.push({ role: item.role, content: item.content });
    }

    messages.push({ role: 'user', content: params.userMessage });
    return messages;
  }
}
