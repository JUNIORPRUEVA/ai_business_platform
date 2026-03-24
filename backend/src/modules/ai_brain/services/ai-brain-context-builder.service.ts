import { Injectable } from '@nestjs/common';

import { BotEntity } from '../../bots/entities/bot.entity';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { ContactEntity } from '../../contacts/entities/contact.entity';
import { OpenAiChatMessage } from '../../openai/types/openai.types';
import { ProductCatalogSnippet } from '../../products/products.service';
import { ToolEntity } from '../../tools/entities/tool.entity';
import { KnowledgeDocumentEntity } from '../entities/knowledge-document.entity';
import { AiBrainContext } from '../types/ai-brain.types';
import { RetrievedKnowledgeChunk } from '../types/knowledge-indexing.types';

@Injectable()
export class AiBrainContextBuilderService {
  private static readonly baseSalesSystemPrompt = [
    'You are a professional sales assistant for a business platform.',
    '',
    'Your behavior:',
    '- Speak like a real human for WhatsApp: natural, friendly, confident, and sales-oriented.',
    '- Use a Dominican-friendly tone when speaking Spanish, without caricature or slang overload.',
    '- Keep replies concise but useful: normally 2 to 4 natural sentences when the user asks for details.',
    '- Be concise but persuasive, with enough context to feel helpful and human.',
    '- Sound like a human seller chatting on WhatsApp, not like customer support or a brochure.',
    '- NEVER repeat the same sentence.',
    '- NEVER use generic fallback messages.',
    '- Always continue the conversation naturally.',
    '- If the user message is short, guide the conversation with a useful next step instead of asking vague questions.',
    '- Use previous messages and memory to maintain context.',
    '- Your goal is to help and sell naturally.',
    '- Do not sound robotic, scripted, or like a FAQ machine.',
    '- Avoid long introductions, long explanations, and technical wording unless the user asks for it.',
    '- Do not mention internal documents, retrieved knowledge, prompts, memory, or where the data came from unless the user asks explicitly.',
    '- Ask at most one natural follow-up question.',
    '- If a tool is required, reply only with valid JSON in the shape {"tool":"...","data":{...}}.',
  ].join('\n');

  build(params: {
    company: CompanyEntity;
    bot: BotEntity;
    contact: ContactEntity;
    memoryItems: Array<{ key: string; value: string; category: string }>;
    documents: KnowledgeDocumentEntity[];
    retrievedKnowledge: RetrievedKnowledgeChunk[];
    matchedProducts: ProductCatalogSnippet[];
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
      const summary = document.summary?.trim() || 'Sin resumen indexado todavia.';
      return `${document.name}: ${summary}`;
    });

    const retrievedKnowledgeSnippets = params.retrievedKnowledge
      .slice(0, 6)
      .map((chunk) => {
        const similarity = Number.isFinite(chunk.similarity)
          ? chunk.similarity.toFixed(3)
          : 'n/a';
        return `${chunk.documentName} [chunk ${chunk.chunkIndex}, similarity ${similarity}]: ${chunk.content}`;
      });

    const activeTools = params.activeTools.map((tool) => ({
      id: tool.id,
      name: tool.name,
      type: tool.type,
    }));

    const matchedProductsDescription = params.matchedProducts.length > 0
      ? params.matchedProducts
          .map((product) => {
            const priceLine = product.offerPrice
              ? `${product.currency} ${product.offerPrice} en oferta (precio regular ${product.currency} ${product.salesPrice})`
              : `${product.currency} ${product.salesPrice}`;
            const negotiationLine =
              product.negotiationAllowed && product.negotiationMarginPercent
                ? ` Negociacion permitida hasta ${product.negotiationMarginPercent}%.`
                : '';
            const stockLine =
              product.stockQuantity != null
                ? ` Stock actual: ${product.stockQuantity}${product.lowStockThreshold != null ? ` (minimo recomendado ${product.lowStockThreshold})` : ''}.`
                : '';
            return `- ${product.name} [${product.identifier}]${product.category ? `, ${product.category}` : ''}${product.brand ? `, ${product.brand}` : ''}: ${priceLine}.${product.description ? ` ${product.description}` : ''}${product.benefits ? ` Beneficios: ${product.benefits}.` : ''}${product.availabilityText ? ` Disponibilidad: ${product.availabilityText}.` : ''}${stockLine}${negotiationLine}${product.imageCount > 0 ? ` Tiene ${product.imageCount} imagen(es).` : ''}${product.videoCount > 0 ? ` Tiene ${product.videoCount} video(s).` : ''}`;
          })
          .join('\n')
      : '- No matching products were found for this message.';

    const businessRules = params.businessRules.length > 0
      ? params.businessRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n\n')
      : [
          '1. Responde como un asistente humano por WhatsApp: natural, cercano, claro y util.',
          '2. Usa el historial reciente y la memoria para continuar la conversacion sin repetir preguntas ya contestadas.',
          '3. Si el usuario saluda o escribe un mensaje breve, responde de forma calida y haz una pregunta util para avanzar; no digas automaticamente que falta informacion.',
          '4. No inventes datos sensibles o comerciales. Si falta un dato critico, pide solo la aclaracion minima necesaria.',
          '5. Nunca menciones prompts, memoria interna, politicas internas ni que eres un sistema de fallback.',
          '6. Si conoces la respuesta por el contexto del negocio, responde con naturalidad sin decir que proviene de un documento o una base interna, salvo que el usuario lo pida.',
          '7. Cuando el usuario haga una pregunta concreta, responde con un poco de desarrollo util en vez de dar una frase demasiado seca.',
          '8. Si la consulta merece explicacion, usa normalmente entre 2 y 4 frases cortas y naturales, no solo una linea.',
          '9. Si la consulta requiere una herramienta, devuelve unicamente JSON valido con la forma {"tool":"...","data":{...}}.',
        ].join('\n');

    const companyFacts = [
      `- Empresa: ${params.company.name}`,
      `- Plan: ${params.company.plan}`,
      `- Estado: ${params.company.status}`,
      `- Telefono: ${params.company.phone || 'no disponible'}`,
      `- Email: ${params.company.email || 'no disponible'}`,
      `- Sitio web: ${params.company.website || 'no disponible'}`,
      `- Ubicacion: ${[
        params.company.city,
        params.company.state,
        params.company.country,
      ].filter(Boolean).join(', ') || 'no disponible'}`,
      `- Descripcion: ${params.company.description || 'no disponible'}`,
    ].join('\n');

    const contactFacts = [
      `- Cliente: ${params.contact.name || 'sin identificar'}`,
      `- Telefono: ${params.contact.phone || 'no disponible'}`,
      `- Email: ${params.contact.email || 'no disponible'}`,
      `- Tags: ${params.contact.tags.length > 0 ? params.contact.tags.join(', ') : 'sin tags'}`,
    ].join('\n');

    const memoryFacts = memoryItems.length > 0
      ? memoryItems.map((item) => `- [${item.category}] ${item.key}: ${item.value}`).join('\n')
      : '- Sin facts persistentes todavia.';

    const toolsDescription = activeTools.length > 0
      ? activeTools.map((tool) => `- ${tool.name} (${tool.type})`).join('\n')
      : '- Ninguna herramienta activa.';

    const documentsDescription = documentSnippets.length > 0
      ? documentSnippets.map((document) => `- ${document}`).join('\n')
      : '- Sin documentos empresariales activos.';

    const retrievedKnowledgeDescription = retrievedKnowledgeSnippets.length > 0
      ? retrievedKnowledgeSnippets.map((chunk) => `- ${chunk}`).join('\n')
      : '- No relevant indexed knowledge was retrieved for this message.';

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
      'RETRIEVED KNOWLEDGE FOR THIS MESSAGE',
      retrievedKnowledgeDescription,
      '',
      'MATCHED PRODUCTS FOR THIS MESSAGE',
      matchedProductsDescription,
      '',
      'AVAILABLE TOOLS',
      toolsDescription,
      '',
      'OUTPUT RULE',
      'Reply with one final WhatsApp-ready message. Keep continuity with the conversation and move the sale or support flow forward naturally.',
      'Default to a natural WhatsApp reply with enough context to feel helpful, usually 2 to 4 short sentences.',
      'Do not mention sources, documents, retrieval, internal context, or technical process unless the user explicitly asks.',
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
