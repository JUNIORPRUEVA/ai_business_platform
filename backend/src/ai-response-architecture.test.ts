import * as assert from 'node:assert/strict';
import { test } from 'node:test';

import { AiBrainAudioService } from './modules/ai_brain/services/ai-brain-audio.service';
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
    retrievedKnowledge: [],
    matchedProducts: [],
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
      getDefaultConfiguration: () => ({
        openai: { temperature: 0.7, maxTokens: 1400 },
      }),
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

test('ai brain replaces long robotic sales copy with a short human whatsapp reply', () => {
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
    draft:
      'Gracias por la descripción detallada. Si te interesa, puedo ayudarte a buscar más información sobre su disponibilidad o características adicionales. Además, si buscas soluciones tecnológicas, también puedo darte detalles sobre nuestros productos.',
    userMessage: 'ok',
    recentMessages: [
      {
        sender: 'client',
        content: 'megáfono portátil',
      },
    ],
    senderName: 'Ana',
    detectedIntent: 'sales',
  });

  assert.ok(normalized.length < 120);
  assert.doesNotMatch(normalized, /gracias por la descripción detallada|si te interesa|además/i);
  assert.match(normalized, /precio|detalles|recomiende/i);
});

test('ai brain replaces replies that echo the same client question', () => {
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
    draft:
      'Entiendo. Seguimos con cuál es la cédula de la persona que se está contratando. ¿Quieres que te recomiende algo?',
    userMessage: '¿Cuál es la cédula de la persona que se está contratando?',
    recentMessages: [],
    senderName: 'Junior',
    detectedIntent: 'general',
  });

  assert.doesNotMatch(normalized, /seguimos con|recomiende algo/i);
  assert.doesNotMatch(normalized, /cu[aá]l es la c[ée]dula de la persona que se est[aá] contratando/i);
  assert.match(normalized, /te respondo directo|te ayudo/i);
});

test('ai brain does not reuse previous client questions as a follow-up topic', () => {
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

  const fallback = (service as any).buildHumanSalesReply({
    userMessage: 'ok',
    recentMessages: [
      {
        sender: 'client',
        content: '¿Cuándo se termina el contrato?',
      },
    ],
    senderName: 'Junior',
    detectedIntent: 'sales',
  });

  assert.doesNotMatch(fallback, /seguimos con|cu[aá]ndo se termina el contrato/i);
  assert.match(fallback, /precio|detalles|disponibilidad/i);
});

test('ai brain answers video questions using the stored video analysis context', () => {
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
    draft: 'No puedo transcribir el contenido del video directamente, pero parece mostrar algunos productos.',
    userMessage: 'Que dice el video?',
    recentMessages: [
      {
        sender: 'client',
        type: 'video',
        content: 'Contexto del cliente: envio un video. Resumen del video: una mujer muestra audifonos P9 Ultra 2 y varias correas de reloj sobre la mesa.',
        metadata: {
          videoAnalysis: {
            status: 'completed',
            text: 'una mujer muestra audifonos P9 Ultra 2 y varias correas de reloj sobre la mesa.',
            transcript: 'presenta los audifonos P9 Ultra 2 y accesorios disponibles',
          },
        },
      },
    ],
    senderName: 'Ana',
    detectedIntent: 'general',
  });

  assert.doesNotMatch(normalized, /no puedo transcribir/i);
  assert.match(normalized, /en el audio del video se entiende|en ese video se ve/i);
  assert.match(normalized, /audifonos|correas|accesorios/i);
});

test('ai brain falls back to the visual summary when asking about a video without transcript', () => {
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
    draft: 'Parece que el video muestra productos interesantes. Si quieres te doy mas informacion.',
    userMessage: 'Que muestra el video?',
    recentMessages: [
      {
        sender: 'client',
        type: 'video',
        content: 'Contexto del cliente: envio un video. Resumen del video: se ve un molinillo electrico en primer plano y especias sobre la mesa.',
        metadata: {
          videoAnalysis: {
            status: 'completed',
            text: 'se ve un molinillo electrico en primer plano y especias sobre la mesa.',
          },
        },
      },
    ],
    senderName: 'Ana',
    detectedIntent: 'general',
  });

  assert.match(normalized, /en ese video se ve/i);
  assert.match(normalized, /molinillo|especias/i);
});

test('ai brain uses the nearest previous analyzed video when multiple videos exist in the conversation', () => {
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
    draft: 'En resumen, el video muestra esto: Análisis del Video Fotograma 1: una mujer con audifonos y correas.',
    userMessage: 'Que dice el video?',
    recentMessages: [
      {
        id: 'video-1',
        sender: 'client',
        type: 'video',
        content: 'Contexto del cliente: envio un video. Resumen del video: una mujer muestra audifonos P9 Ultra 2 y correas de reloj.',
        createdAt: new Date('2026-03-23T18:20:00.000Z'),
        metadata: {
          videoAnalysis: {
            status: 'completed',
            text: 'una mujer muestra audifonos P9 Ultra 2 y correas de reloj.',
            transcript: 'presenta audifonos y accesorios',
          },
        },
      },
      {
        id: 'bot-1',
        sender: 'bot',
        type: 'text',
        content: 'Perfecto.',
        createdAt: new Date('2026-03-23T18:21:00.000Z'),
      },
      {
        id: 'video-2',
        sender: 'client',
        type: 'video',
        content: 'Contexto del cliente: envio un video. Resumen del video: inicia con el logo de FULLTECH y luego muestra informacion de la marca.',
        createdAt: new Date('2026-03-23T18:46:55.000Z'),
        metadata: {
          videoAnalysis: {
            status: 'completed',
            text: 'Análisis del Video 1. Introducción: el video inicia con el logo de FULLTECH en fondo negro. Luego muestra informacion breve de la marca.',
            transcript: 'fulltech soluciones para tu negocio',
          },
        },
      },
      {
        id: 'question-1',
        sender: 'client',
        type: 'text',
        content: 'Que dice el video?',
        createdAt: new Date('2026-03-23T18:47:08.000Z'),
      },
    ],
    senderName: 'Ana',
    detectedIntent: 'general',
  });

  assert.match(normalized, /fulltech|negocio/i);
  assert.doesNotMatch(normalized, /audifonos|correas/i);
});

test('ai brain cleans technical video summaries before replying', () => {
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
    draft: 'En resumen, el video muestra esto: Análisis del Video Fotograma 1: Descripción: una mujer muestra productos.',
    userMessage: 'Que muestra el video?',
    recentMessages: [
      {
        sender: 'client',
        type: 'video',
        content: 'Contexto del cliente: envio un video. Resumen del video: una mujer muestra un reloj y accesorios.',
        createdAt: new Date('2026-03-23T18:20:00.000Z'),
        metadata: {
          videoAnalysis: {
            status: 'completed',
            text: 'Análisis del Video Fotograma 1: Descripción: una mujer muestra un reloj y accesorios sobre la mesa.',
          },
        },
      },
      {
        sender: 'client',
        type: 'text',
        content: 'Que muestra el video?',
        createdAt: new Date('2026-03-23T18:21:00.000Z'),
      },
    ],
    senderName: 'Ana',
    detectedIntent: 'general',
  });

  assert.doesNotMatch(normalized, /an[aá]lisis del video|fotograma|descripci[oó]n/i);
  assert.match(normalized, /reloj|accesorios/i);
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

test('ai brain prioriza el prompt configurado en bot-configuration sobre otras fuentes', () => {
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

  const resolved = (service as any).resolvePromptInputs(
    {
      prompts: [
        {
          id: 'prompt-1',
          title: 'Principal',
          description: 'Prompt principal',
          content: 'PROMPT DESDE CONFIGURACION',
          updatedAt: new Date().toISOString(),
        },
      ],
      openai: {
        systemPromptPreview: 'PROMPT PREVIEW',
      },
    },
    {
      systemPrompt: 'PROMPT DEL BOT',
    },
    'sales',
    [
      {
        type: 'system',
        content: 'PROMPT ACTIVO EN TABLA',
      },
      {
        type: 'behavior',
        content: 'REGLA DINAMICA',
      },
    ],
  );

  assert.equal(resolved.systemInstructions, 'PROMPT DESDE CONFIGURACION');
  assert.equal(resolved.mainBotPrompt, 'PROMPT DESDE CONFIGURACION');
  assert.equal(resolved.systemSource, 'bot_configuration.prompts[0]');
  assert.equal(resolved.mainSource, 'bot_configuration.prompts[0]');
  assert.ok(resolved.businessRules.includes('REGLA DINAMICA'));
  assert.ok(
    resolved.businessRules.some((rule: string) =>
      /responde primero la pregunta real del usuario/i.test(rule),
    ),
  );
});

test('ai brain audio recupera audio real desde rawPayloadJson cuando el storage guardado no es reproducible', async () => {
  const service = Object.create(AiBrainAudioService.prototype) as AiBrainAudioService;
  Object.assign(service as object, {
    logger: { log: () => undefined, warn: () => undefined, error: () => undefined },
    whatsappMessagesRepository: {
      findOne: async () => ({
        id: 'wa-message-1',
        companyId: 'company-1',
        channelConfigId: 'config-1',
        mediaStoragePath: 'company-1/media/audio-invalid.ogg',
        mediaUrl: 'https://mmg.whatsapp.net/fake.enc',
        mediaOriginalName: 'voice-note.ogg',
        mimeType: 'audio/ogg; codecs=opus',
        rawPayloadJson: {
          data: {
            message: {
              audioMessage: {
                mimetype: 'audio/ogg; codecs=opus',
              },
            },
          },
        },
      }),
    },
    storageService: {
      getObjectBuffer: async () => ({
        buffer: Buffer.alloc(4096, 0xab),
        contentType: 'application/octet-stream',
      }),
    },
    whatsappChannelConfigService: {
      getEntityById: async () => ({ id: 'config-1' }),
    },
    evolutionApiClient: {
      downloadMediaUrl: async () => ({
        buffer: Buffer.alloc(4096, 0xab),
        contentType: 'application/octet-stream',
      }),
      downloadMediaMessage: async () => ({
        buffer: Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02, 0x00, 0x00]),
        contentType: 'audio/ogg',
      }),
    },
  });

  const resolveAudioSource = (
    service as unknown as {
      resolveAudioSource: (
        companyId: string,
        message: {
          id: string;
          mediaUrl: string | null;
          fileName: string | null;
          mimeType: string | null;
          metadata: Record<string, unknown>;
        },
      ) => Promise<{ buffer: Buffer; filename: string; contentType: string | null } | null>;
    }
  ).resolveAudioSource.bind(service);

  const resolved = await resolveAudioSource('company-1', {
    id: 'app-message-1',
    mediaUrl: 'company-1/media/audio-invalid.ogg',
    fileName: 'voice-note.ogg',
    mimeType: 'audio/ogg; codecs=opus',
    metadata: {
      whatsappChannelMessageId: 'wa-message-1',
    },
  });

  assert.ok(resolved);
  assert.equal(resolved?.filename, 'voice-note.ogg');
  assert.equal(resolved?.contentType, 'audio/ogg');
  assert.equal(resolved?.buffer.subarray(0, 4).toString('ascii'), 'OggS');
});

test('ai brain reutiliza la transcripcion ya guardada del audio sin reprocesarlo', async () => {
  let audioResolutionCalls = 0;
  let updateMessageContentCalls = 0;

  const service = new AiBrainService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      updateMessageContent: async () => {
        updateMessageContentCalls += 1;
        throw new Error('updateMessageContent should not be called');
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { save: async () => undefined } as never,
    {
      resolveInboundAudioText: async () => {
        audioResolutionCalls += 1;
        return {
          content: 'Texto transcrito',
          metadataPatch: {
            audioTranscription: {
              status: 'completed',
              text: 'Texto transcrito',
            },
          },
        };
      },
    } as never,
    {
      getJson: async () => null,
      setJson: async () => undefined,
    } as never,
  );

  const resolved = await (
    service as unknown as {
      resolveInboundMessageContent: (
        companyId: string,
        conversationId: string,
        message: {
          id: string;
          type: string;
          content: string;
          metadata: Record<string, unknown>;
        },
      ) => Promise<{ content: string; metadata: Record<string, unknown> }>;
    }
  ).resolveInboundMessageContent('company-1', 'conversation-1', {
    id: 'message-1',
    type: 'audio',
    content: 'Texto transcrito',
    metadata: {
      audioTranscription: {
        status: 'completed',
        text: 'Texto transcrito',
        model: 'gpt-4o-mini-transcribe',
      },
    },
  });

  assert.equal(resolved.content, 'Texto transcrito');
  assert.equal(audioResolutionCalls, 0);
  assert.equal(updateMessageContentCalls, 0);
});

test('ai brain reutiliza el analisis ya guardado de la imagen sin reprocesarla', async () => {
  let imageResolutionCalls = 0;
  let updateMessageContentCalls = 0;

  const service = new AiBrainService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      updateMessageContent: async () => {
        updateMessageContentCalls += 1;
        throw new Error('updateMessageContent should not be called');
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { save: async () => undefined } as never,
    {} as never,
    {
      resolveInboundImageText: async () => {
        imageResolutionCalls += 1;
        return {
          content: 'El cliente envió una imagen. Análisis visual: una caja de producto color azul.',
          metadataPatch: {
            imageAnalysis: {
              status: 'completed',
              text: 'una caja de producto color azul',
              content: 'El cliente envió una imagen. Análisis visual: una caja de producto color azul.',
            },
          },
        };
      },
    } as never,
    {
      getJson: async () => null,
      setJson: async () => undefined,
    } as never,
  );

  const resolved = await (
    service as unknown as {
      resolveInboundMessageContent: (
        companyId: string,
        conversationId: string,
        message: {
          id: string;
          type: string;
          content: string;
          metadata: Record<string, unknown>;
        },
      ) => Promise<{ content: string; metadata: Record<string, unknown> }>;
    }
  ).resolveInboundMessageContent('company-1', 'conversation-1', {
    id: 'message-image-1',
    type: 'image',
    content: 'El cliente envió una imagen. Análisis visual: una caja de producto color azul.',
    metadata: {
      imageAnalysis: {
        status: 'completed',
        text: 'una caja de producto color azul',
        content: 'El cliente envió una imagen. Análisis visual: una caja de producto color azul.',
      },
    },
  });

  assert.match(resolved.content, /caja de producto color azul/i);
  assert.equal(imageResolutionCalls, 0);
  assert.equal(updateMessageContentCalls, 0);
});

test('ai brain reutiliza el analisis ya guardado del video sin reprocesarlo', async () => {
  let videoResolutionCalls = 0;
  let updateMessageContentCalls = 0;

  const service = new AiBrainService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      updateMessageContent: async () => {
        updateMessageContentCalls += 1;
        throw new Error('updateMessageContent should not be called');
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { save: async () => undefined } as never,
    {} as never,
    {} as never,
    {
      getJson: async () => null,
      setJson: async () => undefined,
    } as never,
    {
      resolveInboundVideoText: async () => {
        videoResolutionCalls += 1;
        return {
          content: 'El cliente envió un video. Análisis del video: se muestra un producto girando sobre una mesa.',
          metadataPatch: {
            videoAnalysis: {
              status: 'completed',
              text: 'se muestra un producto girando sobre una mesa',
              content: 'El cliente envió un video. Análisis del video: se muestra un producto girando sobre una mesa.',
            },
          },
        };
      },
    } as never,
  );

  const resolved = await (
    service as unknown as {
      resolveInboundMessageContent: (
        companyId: string,
        conversationId: string,
        message: {
          id: string;
          type: string;
          content: string;
          metadata: Record<string, unknown>;
        },
      ) => Promise<{ content: string; metadata: Record<string, unknown> }>;
    }
  ).resolveInboundMessageContent('company-1', 'conversation-1', {
    id: 'message-video-1',
    type: 'video',
    content: 'El cliente envió un video. Análisis del video: se muestra un producto girando sobre una mesa.',
    metadata: {
      videoAnalysis: {
        status: 'completed',
        text: 'se muestra un producto girando sobre una mesa',
        content: 'El cliente envió un video. Análisis del video: se muestra un producto girando sobre una mesa.',
      },
    },
  });

  assert.match(resolved.content, /producto girando sobre una mesa/i);
  assert.equal(videoResolutionCalls, 0);
  assert.equal(updateMessageContentCalls, 0);
});

test('ai brain reutiliza el texto ya extraido de un documento sin reprocesarlo', async () => {
  let documentResolutionCalls = 0;
  let updateMessageContentCalls = 0;

  const service = new AiBrainService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {
      updateMessageContent: async () => {
        updateMessageContentCalls += 1;
        throw new Error('updateMessageContent should not be called');
      },
    } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { save: async () => undefined } as never,
    {} as never,
    {} as never,
    {
      getJson: async () => null,
      setJson: async () => undefined,
    } as never,
    {} as never,
    {
      resolveInboundDocumentText: async () => {
        documentResolutionCalls += 1;
        return {
          content: 'El cliente envió un documento (catalogo.pdf). Texto extraído: catálogo de productos con precios y stock.',
          metadataPatch: {
            documentAnalysis: {
              status: 'completed',
              text: 'catálogo de productos con precios y stock.',
              content: 'El cliente envió un documento (catalogo.pdf). Texto extraído: catálogo de productos con precios y stock.',
            },
          },
        };
      },
    } as never,
  );

  const resolved = await (
    service as unknown as {
      resolveInboundMessageContent: (
        companyId: string,
        conversationId: string,
        message: {
          id: string;
          type: string;
          content: string;
          metadata: Record<string, unknown>;
        },
      ) => Promise<{ content: string; metadata: Record<string, unknown> }>;
    }
  ).resolveInboundMessageContent('company-1', 'conversation-1', {
    id: 'message-document-1',
    type: 'document',
    content: 'El cliente envió un documento (catalogo.pdf). Texto extraído: catálogo de productos con precios y stock.',
    metadata: {
      documentAnalysis: {
        status: 'completed',
        text: 'catálogo de productos con precios y stock.',
        content: 'El cliente envió un documento (catalogo.pdf). Texto extraído: catálogo de productos con precios y stock.',
      },
    },
  });

  assert.match(resolved.content, /cat[aá]logo de productos con precios y stock/i);
  assert.equal(documentResolutionCalls, 0);
  assert.equal(updateMessageContentCalls, 0);
});

test('ai brain responde preguntas de cotizacion usando campos estructurados del documento', () => {
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

  const reply = (service as unknown as {
    normalizeAssistantReply: (params: {
      draft: string;
      userMessage: string;
      recentMessages: Array<{
        sender: string;
        type: string;
        content: string;
        createdAt: Date;
        metadata?: Record<string, unknown>;
      }>;
      senderName: string | null;
      detectedIntent: string;
    }) => string;
  }).normalizeAssistantReply({
    draft: 'No logro verlo con claridad.',
    userMessage: 'A nombre de quien esta la cotizacion que te envie',
    recentMessages: [
      {
        sender: 'client',
        type: 'document',
        content: 'Documento recibido',
        createdAt: new Date('2026-03-23T20:39:05.000Z'),
        metadata: {
          documentAnalysis: {
            status: 'completed',
            text: 'COT-00047 Cliente FULLTECH SRL total RD$ 25,000',
            content: 'El cliente envió un documento (COT-00047.pdf). Texto extraído: COT-00047 Cliente FULLTECH SRL total RD$ 25,000',
            businessSummary: {
              quoteNumber: 'COT-00047',
              customerName: 'FULLTECH SRL',
              totalAmount: 'RD$ 25,000',
              validUntil: null,
              summary: 'cotización COT-00047, a nombre de FULLTECH SRL, por RD$ 25,000',
            },
          },
        },
      },
    ],
    senderName: 'Junior',
    detectedIntent: 'general',
  });

  assert.equal(reply, 'La cotización está a nombre de FULLTECH SRL.');
});

test('ai brain responde preguntas amplias sobre el contenido de la factura usando el resumen del documento', () => {
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

  const reply = (service as unknown as {
    normalizeAssistantReply: (params: {
      draft: string;
      userMessage: string;
      recentMessages: Array<{
        sender: string;
        type: string;
        content: string;
        createdAt: Date;
        metadata?: Record<string, unknown>;
      }>;
      senderName: string | null;
      detectedIntent: string;
    }) => string;
  }).normalizeAssistantReply({
    draft: 'No tengo acceso al contenido de la factura.',
    userMessage: 'Y de que habla la factura?',
    recentMessages: [
      {
        sender: 'client',
        type: 'document',
        content: 'Documento recibido',
        createdAt: new Date('2026-03-23T21:09:18.000Z'),
        metadata: {
          documentAnalysis: {
            status: 'completed',
            text: 'COT-00047 Cliente JONAS J. CELL total RD$ 25,000 equipos y accesorios',
            content:
              'El cliente enviÃ³ un documento (COT-00047.pdf). Texto extraÃ­do: cotizaciÃ³n COT-00047 a nombre de JONAS J. CELL para equipos y accesorios por RD$ 25,000.',
            businessSummary: {
              quoteNumber: 'COT-00047',
              customerName: 'JONAS J. CELL',
              totalAmount: 'RD$ 25,000',
              validUntil: null,
              summary:
                'una cotizaciÃ³n COT-00047 a nombre de JONAS J. CELL para equipos y accesorios por RD$ 25,000',
            },
          },
        },
      },
    ],
    senderName: 'Junior',
    detectedIntent: 'general',
  });

  assert.equal(
    reply,
    'En el documento aparece una cotizaciÃ³n COT-00047 a nombre de JONAS J. CELL para equipos y accesorios por RD$ 25,000.',
  );
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

test('ai brain sends whatsapp reply to inbound remoteJid before contactPhone fallback', async () => {
  const sendTargets: Array<{ remoteJid: string; text: string }> = [];
  const aiBrainLogs: Array<Record<string, unknown>> = [];

  const service = new AiBrainService(
    {
      getConfiguration: () => ({
        memory: {
          recentMessageWindowSize: 10,
          summaryRefreshThreshold: 3,
          enableShortTermMemory: false,
          enableOperationalMemory: false,
          summaryEnabled: false,
        },
        orchestrator: {
          automaticMode: true,
          enableToolExecution: false,
        },
        general: {
          isEnabled: true,
        },
        openai: {
          temperature: 0.7,
          maxTokens: 500,
          systemPromptPreview: 'Vende con contexto.',
        },
        prompts: [],
      }),
    } as never,
    {
      getMyCompany: async () => ({
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
      }),
    } as never,
    {
      get: async () => ({
        id: 'channel-1',
        companyId: 'company-1',
        type: 'whatsapp',
        status: 'active',
        config: {},
      }),
    } as never,
    {
      get: async () => ({ id: 'contact-1', name: 'Cliente', phone: '18295319442', tags: [] }),
    } as never,
    {
      get: async () => ({ id: 'conversation-1', contactId: 'contact-1' }),
    } as never,
    {
      getById: async () => ({
        id: 'message-1',
        sender: 'client',
        content: 'Hola',
      }),
      listRecent: async () => [
        {
          id: 'message-1',
          sender: 'client',
          content: 'Hola',
          createdAt: new Date('2026-03-22T10:00:00.000Z'),
        },
      ],
      create: async (_companyId: string, _conversationId: string, payload: Record<string, unknown>) => ({
        id: 'bot-message-1',
        ...payload,
      }),
    } as never,
    {
      getDefaultActiveBot: async () => ({
        id: 'bot-1',
        status: 'active',
        model: 'gpt-5.4-mini',
        temperature: null,
        systemPrompt: 'Vende con contexto.',
        name: 'Sales Bot',
        language: 'es',
      }),
    } as never,
    {
      list: async () => [],
    } as never,
    {
      listActive: async () => [],
    } as never,
    {
      extractClientMemories: () => [],
      assembleContext: async () => ({
        keyFacts: [],
        operationalState: [],
        summary: null,
        recentWindow: [],
        contextText: '',
      }),
      getContactMemoryMap: async () => ({}),
      persistAiConversationLog: async () => undefined,
    } as never,
    {
      draftResponse: async () => ({
        provider: 'mock',
        model: 'gpt-5.4-mini',
        content: 'Respuesta al cliente',
        usedMockFallback: false,
        systemPrompt: 'Vende con contexto.',
      }),
    } as never,
    {
      listAvailable: async () => [],
    } as never,
    new AiBrainContextBuilderService(),
    {
      tryParse: () => null,
    } as never,
    {
      sendText: async (_companyId: string, payload: { remoteJid: string; text: string }) => {
        sendTargets.push(payload);
        return { message: { id: 'wa-message-1' } };
      },
    } as never,
    {
      create: (payload: Record<string, unknown>) => payload,
      save: async (payload: Record<string, unknown>) => {
        aiBrainLogs.push(payload);
        return payload;
      },
    } as never,
  );

  await service.processInboundMessage({
    companyId: 'company-1',
    channelId: 'channel-1',
    conversationId: 'conversation-1',
    contactPhone: '18295319442',
    remoteJid: '234840490270800@lid',
    messageId: 'message-1',
  });

  assert.deepEqual(sendTargets, [
    {
      remoteJid: '234840490270800@lid',
      text: 'Respuesta al cliente',
    },
  ]);
  assert.equal(aiBrainLogs.at(-1)?.['status'], 'processed');
});
