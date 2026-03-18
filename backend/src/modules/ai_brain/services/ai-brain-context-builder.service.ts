import { Injectable } from '@nestjs/common';

import { BotEntity } from '../../bots/entities/bot.entity';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { ContactEntity } from '../../contacts/entities/contact.entity';
import { ToolEntity } from '../../tools/entities/tool.entity';
import { KnowledgeDocumentEntity } from '../entities/knowledge-document.entity';
import { AiBrainContext } from '../types/ai-brain.types';

@Injectable()
export class AiBrainContextBuilderService {
  build(params: {
    company: CompanyEntity;
    bot: BotEntity;
    contact: ContactEntity;
    memoryItems: Array<{ key: string; value: string; category: string }>;
    documents: KnowledgeDocumentEntity[];
    activeTools: ToolEntity[];
    assembledMemoryContext: string;
    detectedIntent: string;
  }): AiBrainContext {
    const memoryItems = params.memoryItems.map((item) => ({
      key: item.key,
      value: item.value,
      category: item.category,
    }));

    const documentSnippets = params.documents.slice(0, 4).map((document) => {
      const summary = document.summary?.trim() || 'Sin resumen indexado todavía.';
      return `${document.name}: ${summary}`;
    });

    const activeTools = params.activeTools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      type: tool.type,
    }));

    return {
      detectedIntent: params.detectedIntent,
      prompt: [
        params.bot.systemPrompt?.trim() || 'Eres el cerebro comercial de la empresa.',
        '',
        'Contexto de empresa:',
        `- Empresa: ${params.company.name}`,
        `- Bot: ${params.bot.name}`,
        `- Idioma: ${params.bot.language || 'es'}`,
        `- Cliente: ${params.contact.name || params.contact.phone || 'sin identificar'}`,
        '',
        'Política operativa:',
        '- Responde solo con información verificable.',
        '- Si la pregunta requiere ejecutar una herramienta, responde únicamente con JSON válido usando {"tool":"...","data":{...}}.',
        '- Si no tienes certeza, pide aclaración o escala a un humano.',
        '',
        activeTools.length > 0
          ? `Herramientas activas: ${activeTools.map((tool) => `${tool.name} (${tool.type})`).join(', ')}`
          : 'Herramientas activas: ninguna.',
        documentSnippets.length > 0
          ? `Documentos empresariales: ${documentSnippets.join(' | ')}`
          : 'Documentos empresariales: ninguno.',
      ].join('\n'),
      memoryContext: [
        `Intento detectado: ${params.detectedIntent}`,
        '',
        params.assembledMemoryContext,
      ].join('\n'),
      memoryItems,
      documentSnippets,
      activeTools,
    };
  }
}