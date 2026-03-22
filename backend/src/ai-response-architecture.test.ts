import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { AiBrainContextBuilderService } from './modules/ai_brain/services/ai-brain-context-builder.service';
import { AiBrainService } from './modules/ai_brain/services/ai-brain.service';
import { OpenAiService } from './modules/openai/services/openai.service';

test('ai brain context builder injects summary and facts as dedicated system messages', () => {
  const service = new AiBrainContextBuilderService();

  const context = service.build({
    company: {
      name: 'Demo Company',
      plan: 'pro',
      status: 'active',
      phone: '',
      email: '',
      website: '',
      city: '',
      state: '',
      country: '',
      description: '',
    } as never,
    bot: {
      name: 'Sales Bot',
      language: 'es',
      model: 'gpt-5.4-mini',
    } as never,
    contact: {
      name: 'Juan',
      phone: '8090000000',
      email: '',
      tags: [],
    } as never,
    memoryItems: [
      { key: 'interest', value: 'camaras', category: 'sales' },
    ],
    documents: [],
    activeTools: [],
    assembledMemoryContext: 'Cliente interesado en camaras para negocio.',
    detectedIntent: 'sales',
    systemInstructions: 'Habla natural y vende con contexto.',
    mainBotPrompt: 'Cierra ventas sin sonar robotico.',
    businessRules: [],
    recentMessages: [
      { role: 'assistant', content: 'Hola, te puedo ayudar con eso.' },
    ],
    incomingMessage: 'Hola',
  });

  assert.equal(context.modelMessages[0].role, 'system');
  assert.match(context.modelMessages[0].content, /professional sales assistant/i);
  assert.equal(context.modelMessages[1].role, 'system');
  assert.match(context.modelMessages[1].content, /Conversation summary:/);
  assert.equal(context.modelMessages[2].role, 'system');
  assert.match(context.modelMessages[2].content, /Relevant facts:/);
  assert.equal(context.modelMessages.at(-1)?.role, 'user');
});

test('openai mock fallback responds naturally for greetings', async () => {
  const service = new OpenAiService(
    { get: () => undefined } as never,
    {
      getConfiguration: () => ({
        openai: { temperature: 0.7, maxTokens: 1400 },
      }),
      getResolvedOpenAiRuntimeSettings: () => ({
        apiKey: '',
        model: 'gpt-5.4-mini',
        apiUrl: 'https://api.openai.com/v1/chat/completions',
        source: 'configuration',
        runtimeEnabled: true,
      }),
    } as never,
  );

  const response = await service.draftResponse({
    senderName: 'Luis',
    detectedIntent: 'sales',
    message: 'Hola',
  });

  assert.equal(response.provider, 'mock');
  assert.doesNotMatch(response.content, /mensaje es muy breve|recibimos tu|procesando/i);
  assert.match(response.content, /hola|que estas buscando|opciones|ayudarte/i);
});

test('ai brain replaces generic repetitive replies with a human sales reply', () => {
  const service = new AiBrainService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const normalized = (service as any).normalizeAssistantReply({
    draft: 'Parece que tu mensaje es muy breve, podrías darme más detalles.',
    userMessage: 'Hola',
    recentMessages: [],
    senderName: 'Ana',
    detectedIntent: 'sales',
  });

  assert.doesNotMatch(normalized, /mensaje es muy breve|podr[ií]as darme m[aá]s detalles/i);
  assert.match(normalized, /hola|opciones|interesarte|ayudarte/i);
});

test('ai brain transcript builder keeps chronological order and ignores operator messages', () => {
  const service = new AiBrainService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const transcript = (service as any).buildRecentTranscriptMessages(
    [
      {
        id: 'message-2',
        sender: 'bot',
        content: 'Hola, dime que necesitas.',
        createdAt: new Date('2026-03-22T10:01:00.000Z'),
      },
      {
        id: 'message-1',
        sender: 'client',
        content: 'Hola',
        createdAt: new Date('2026-03-22T10:00:00.000Z'),
      },
      {
        id: 'message-3',
        sender: 'user',
        content: 'Nota interna de operador',
        createdAt: new Date('2026-03-22T10:02:00.000Z'),
      },
      {
        id: 'message-4',
        sender: 'client',
        content: 'Quiero precios',
        createdAt: new Date('2026-03-22T10:03:00.000Z'),
      },
    ],
    'message-4',
  );

  assert.deepEqual(transcript, [
    { role: 'user', content: 'Hola' },
    { role: 'assistant', content: 'Hola, dime que necesitas.' },
  ]);
});

test('ai brain rejects openai payloads when the last message is not the latest user input', () => {
  const service = new AiBrainService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  assert.throws(
    () => (service as any).ensureValidOpenAiMessages([
      { role: 'system', content: 'Rules' },
      { role: 'assistant', content: 'Mensaje viejo del bot' },
    ], 'Hola'),
    /latest openai message must be from user/i,
  );

  assert.throws(
    () => (service as any).ensureValidOpenAiMessages([
      { role: 'system', content: 'Rules' },
      { role: 'user', content: 'Mensaje anterior' },
    ], 'Hola'),
    /latest user message mismatch/i,
  );
});