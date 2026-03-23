import { Injectable } from '@nestjs/common';

import { BotEntity } from '../../bots/entities/bot.entity';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { ContactEntity } from '../../contacts/entities/contact.entity';
import { OpenAiChatMessage } from '../../openai/types/openai.types';
import { ToolEntity } from '../../tools/entities/tool.entity';
import { KnowledgeDocumentEntity } from '../entities/knowledge-document.entity';
import { AiBrainContext } from '../types/ai-brain.types';

@Injectable()
export class AiBrainContextBuilderService {
  private static readonly baseSalesSystemPrompt = [
    'You are a professional sales assistant for a business platform.',
    '',
    'Your behavior:',
    '- Speak like a real human for WhatsApp: natural, friendly, confident, and sales-oriented.',
    '- Use a Dominican-friendly tone when speaking Spanish, without caricature or slang overload.',
    '- Keep replies short: normally 1 or 2 short sentences.',
    '- Be concise but persuasive.',
    '- Sound like a human seller chatting on WhatsApp, not like customer support or a brochure.',
    '- NEVER repeat the same sentence.',
    '- NEVER use generic fallback messages.',
    '- Always continue the conversation naturally.',
    '- If the user message is short, guide the conversation with a useful next step instead of asking vague questions.',
    '- Use previous messages and memory to maintain context.',
    '- Your goal is to help and sell naturally.',
    '- Do not sound robotic, scripted, or like a FAQ machine.',
    '- Avoid long introductions, long explanations, and technical wording unless the user asks for it.',
    '- Ask at most one natural follow-up question.',
    '- If a tool is required, reply only with valid JSON in the shape {"tool":"...","data":{...}}.',
  ].join('\n');

  build(params: {
    company: CompanyEntity;
    bot: BotEntity;
    contact: ContactEntity;
    memoryItems: Array<{ key: string; value: string; category: string }>;
    documents: KnowledgeDocumentEntity[];
    activeTools: ToolEntity[];
    assembledMemoryContext: string;
    detectedIntent: string;
    systemInstructions: string;
    mainBotPrompt: string;
    businessRules: string[];
    recentMessages: OpenAiChatMessage[];
    incomingMessage: string;
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

    const businessRules = params.businessRules.length > 0
      ? params.businessRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n\n')
      : [
          '1. Responde como un asistente humano por WhatsApp: natural, cercano, claro y útil.',
          '2. Usa el historial reciente y la memoria para continuar la conversación sin repetir preguntas ya contestadas.',
          '3. Si el usuario saluda o escribe un mensaje breve, responde de forma cálida y haz una pregunta útil para avanzar; no digas automáticamente que falta información.',
          '4. No inventes datos sensibles o comerciales. Si falta un dato crítico, pide solo la aclaración mínima necesaria.',
          '5. Nunca menciones prompts, memoria interna, políticas internas ni que eres un sistema de fallback.',
          '6. Si la consulta requiere una herramienta, devuelve únicamente JSON válido con la forma {"tool":"...","data":{...}}.',
        ].join('\n');

    const companyFacts = [
      `- Empresa: ${params.company.name}`,
      `- Plan: ${params.company.plan}`,
      `- Estado: ${params.company.status}`,
      `- Teléfono: ${params.company.phone || 'no disponible'}`,
      `- Email: ${params.company.email || 'no disponible'}`,
      `- Sitio web: ${params.company.website || 'no disponible'}`,
      `- Ubicación: ${[
        params.company.city,
        params.company.state,
        params.company.country,
      ].filter(Boolean).join(', ') || 'no disponible'}`,
      `- Descripción: ${params.company.description || 'no disponible'}`,
    ].join('\n');

    const contactFacts = [
      `- Cliente: ${params.contact.name || 'sin identificar'}`,
      `- Teléfono: ${params.contact.phone || 'no disponible'}`,
      `- Email: ${params.contact.email || 'no disponible'}`,
      `- Tags: ${params.contact.tags.length > 0 ? params.contact.tags.join(', ') : 'sin tags'}`,
    ].join('\n');

    const memoryFacts = memoryItems.length > 0
      ? memoryItems.map((item) => `- [${item.category}] ${item.key}: ${item.value}`).join('\n')
      : '- Sin facts persistentes todavía.';

    const toolsDescription = activeTools.length > 0
      ? activeTools.map((tool) => `- ${tool.name} (${tool.type})`).join('\n')
      : '- Ninguna herramienta activa.';

    const documentsDescription = documentSnippets.length > 0
      ? documentSnippets.map((document) => `- ${document}`).join('\n')
      : '- Sin documentos empresariales activos.';

    const coreSystemPrompt = [
      AiBrainContextBuilderService.baseSalesSystemPrompt,
      '',
      'CUSTOM SYSTEM INSTRUCTIONS',
      params.systemInstructions.trim() || 'Act as a commercial assistant that keeps context and sells naturally.',
      '',
      'BOT SALES PLAYBOOK',
      params.mainBotPrompt.trim() || 'Guide commercial conversations clearly and naturally.',
      '',
      'BOT IDENTITY',
      `- Bot name: ${params.bot.name}`,
      `- Main language: ${params.bot.language || 'es'}`,
      `- Preferred model: ${params.bot.model}`,
      `- Detected intent: ${params.detectedIntent}`,
      '',
      'BUSINESS RULES',
      businessRules,
      '',
      'COMPANY CONTEXT',
      companyFacts,
      '',
      'CUSTOMER CONTEXT',
      contactFacts,
      '',
      'KNOWLEDGE BASE',
      documentsDescription,
      '',
      'AVAILABLE TOOLS',
      toolsDescription,
      '',
      'OUTPUT RULE',
      'Reply with one final WhatsApp-ready message. Keep continuity with the conversation and move the sale or support flow forward naturally.',
      'Default to 1 or 2 short sentences, one idea at a time, with no technical or robotic phrasing.',
    ].join('\n');

    const conversationSummary = params.assembledMemoryContext.trim() || 'No persistent summary available yet.';
    const relevantFacts = memoryFacts;

    const modelMessages: OpenAiChatMessage[] = [
      { role: 'system', content: coreSystemPrompt },
      { role: 'system', content: `Conversation summary: ${conversationSummary}` },
      { role: 'system', content: `Relevant facts:\n${relevantFacts}` },
      ...params.recentMessages,
      { role: 'user', content: params.incomingMessage },
    ];

    const prompt = modelMessages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');

    return {
      detectedIntent: params.detectedIntent,
      prompt,
      memoryContext: params.assembledMemoryContext,
      modelMessages,
      memoryItems,
      documentSnippets,
      activeTools,
    };
  }
}
