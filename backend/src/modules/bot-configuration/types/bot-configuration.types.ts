export interface GeneralSettings {
  botName: string;
  defaultLanguage: string;
  isEnabled: boolean;
  environmentLabel: string;
}

export interface EvolutionSettings {
  baseUrl: string;
  instanceName: string;
  apiKey: string;
  webhookSecret: string;
  connectedNumber: string;
  channelId?: string | null;
  connectionStatus?: string;
  provisioningStatus?: string;
  provisioningError?: string | null;
  isEnabled: boolean;
}

export interface OpenAiSettings {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  isEnabled: boolean;
  systemPromptPreview: string;
}

export interface IntegrationsSettings {
  metaCloudApiToken: string;
  metaPhoneNumberId: string;
  instagramToken: string;
  webhookUrl: string;
}

export type WhatsappCallHandlingMode =
  | 'ignore'
  | 'notify'
  | 'reject_if_supported';

export interface WhatsappSettings {
  autoApplyWebhook: boolean;
  trackConnectionEvents: boolean;
  trackQrEvents: boolean;
  trackMessageEvents: boolean;
  receiveTextMessages: boolean;
  receiveAudioMessages: boolean;
  receiveImageMessages: boolean;
  receiveVideoMessages: boolean;
  receiveDocumentMessages: boolean;
  persistMediaMetadata: boolean;
  callHandlingMode: WhatsappCallHandlingMode;
  rejectedCallReply: string;
}

export interface MemorySettings {
  enableShortTermMemory: boolean;
  enableLongTermMemory: boolean;
  enableOperationalMemory: boolean;
  recentMessageWindowSize: number;
  automaticSummarization: boolean;
  memoryTtl: string;
  useRedis: boolean;
  usePostgreSql: boolean;
  summaryEnabled: boolean;
  summaryRefreshThreshold: number;
  deduplicationEnabled: boolean;
  pruningEnabled: boolean;
  memoryDebugEnabled: boolean;
}

export interface OrchestratorSettings {
  automaticMode: boolean;
  assistedMode: boolean;
  enableRoleDetection: boolean;
  enableIntentClassification: boolean;
  enableToolExecution: boolean;
  requireConfirmationForCriticalActions: boolean;
  autonomyLevel: 'strict' | 'guarded' | 'balanced';
  fallbackStrategy: string;
}

export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  content: string;
  updatedAt: string;
}

function normalizePromptTemplate(prompt: PromptTemplate): PromptTemplate {
  const normalizedContent = prompt.content
    .trim()
    .replace(/\s+/g, ' ');

  const antiConflictRule =
    ' Answer the user directly, never echo their question, never write phrases like "Seguimos con..." or "¿Quieres que te recomiende algo?" unless they add real value, and sound natural on WhatsApp.';

  return {
    ...prompt,
    content: normalizedContent.includes('never echo their question')
      ? normalizedContent
      : `${normalizedContent}${antiConflictRule}`,
  };
}

export interface InternalToolSettings {
  id: string;
  name: string;
  description: string;
  category: string;
  isEnabled: boolean;
  intents: string[];
  requiresConfirmation: boolean;
}

export interface SecuritySettings {
  internalApiToken: string;
  webhookSigningSecret: string;
  encryptSecrets: boolean;
  auditLog: boolean;
}

export interface BotConfigurationBundle {
  general: GeneralSettings;
  evolution: EvolutionSettings;
  openai: OpenAiSettings;
  integrations: IntegrationsSettings;
  whatsapp: WhatsappSettings;
  memory: MemorySettings;
  orchestrator: OrchestratorSettings;
  prompts: PromptTemplate[];
  tools: InternalToolSettings[];
  security: SecuritySettings;
}

export function createDefaultBotConfiguration(): BotConfigurationBundle {
  return {
    general: {
      botName: 'FULLPOS Enterprise Assistant',
      defaultLanguage: 'pt-BR',
      isEnabled: true,
      environmentLabel: 'Production',
    },
    evolution: {
      baseUrl: 'https://evolution.fullpos.internal',
      instanceName: 'fullpos-main-instance',
      apiKey: '',
      webhookSecret: '',
      connectedNumber: '+55 11 4004-1000',
      channelId: null,
      connectionStatus: 'disconnected',
      provisioningStatus: 'idle',
      provisioningError: null,
      isEnabled: true,
    },
    openai: {
      apiKey: '',
      model: process.env.OPENAI_MODEL ?? 'gpt-5.4-mini',
      temperature: 0.7,
      maxTokens: 1400,
      isEnabled: true,
      systemPromptPreview:
        'You are a professional sales assistant for a business platform. Speak like a real human, keep context, avoid repetitive fallback phrases, keep replies short like WhatsApp, and move the conversation forward in a persuasive but friendly way.',
    },
    integrations: {
      metaCloudApiToken: '',
      metaPhoneNumberId: '',
      instagramToken: '',
      webhookUrl: '',
    },
    whatsapp: {
      autoApplyWebhook: true,
      trackConnectionEvents: true,
      trackQrEvents: true,
      trackMessageEvents: true,
      receiveTextMessages: true,
      receiveAudioMessages: true,
      receiveImageMessages: true,
      receiveVideoMessages: true,
      receiveDocumentMessages: true,
      persistMediaMetadata: true,
      callHandlingMode: 'notify',
      rejectedCallReply:
        'En este canal no atendemos llamadas. Escríbenos por mensaje y te ayudamos enseguida.',
    },
    memory: {
      enableShortTermMemory: true,
      enableLongTermMemory: true,
      enableOperationalMemory: true,
      recentMessageWindowSize: 20,
      automaticSummarization: true,
      memoryTtl: '30d',
      useRedis: true,
      usePostgreSql: true,
      summaryEnabled: true,
      summaryRefreshThreshold: 6,
      deduplicationEnabled: true,
      pruningEnabled: true,
      memoryDebugEnabled: false,
    },
    orchestrator: {
      automaticMode: true,
      assistedMode: true,
      enableRoleDetection: true,
      enableIntentClassification: true,
      enableToolExecution: true,
      requireConfirmationForCriticalActions: true,
      autonomyLevel: 'guarded',
      fallbackStrategy: 'Escalate to operator when certainty is low.',
    },
    prompts: [
      {
        id: 'prompt-sales-qualification',
        title: 'Sales Qualification Prompt',
        description:
          'Controls enterprise qualification, memory loading, escalation rules, and tool selection.',
        content:
          'You are a professional sales assistant for a business platform. Speak like a real human, natural and friendly, with WhatsApp-ready responses that feel useful and warm. Answer the real question first, then move the conversation forward naturally. Never repeat the user question as your answer, never use phrases like "Seguimos con..." or "¿Quieres que te recomiende algo?" as filler, and never use generic fallback messages. Keep continuity with previous messages and memory, and when the user sends a short message guide the conversation with a useful next step instead of vague questions. Keep most replies concise but with enough context, usually 2 to 4 natural sentences when the question needs explanation. Do not mention internal documents, sources, prompts, or knowledge retrieval unless the user asks directly. Your goal is to help and sell naturally without sounding robotic.',
        updatedAt: new Date().toISOString(),
      },
    ],
    tools: [
      {
        id: 'catalog-lookup',
        name: 'Catalog Lookup',
        description: 'Reads product, SKU, and module metadata from the business catalog.',
        category: 'Knowledge',
        isEnabled: true,
        intents: ['product_question', 'catalog_search'],
        requiresConfirmation: false,
      },
      {
        id: 'pricing-policy',
        name: 'Pricing Policy',
        description: 'Loads approved plan and pricing guidance before a commercial reply.',
        category: 'Finance',
        isEnabled: true,
        intents: ['pricing_inquiry', 'billing_question'],
        requiresConfirmation: false,
      },
      {
        id: 'operator-handoff',
        name: 'Operator Handoff',
        description: 'Prepares an internal handoff package for a human operator.',
        category: 'Operations',
        isEnabled: true,
        intents: ['human_handoff', 'support_request', 'configuration_request'],
        requiresConfirmation: true,
      },
    ],
    security: {
      internalApiToken: '',
      webhookSigningSecret: '',
      encryptSecrets: true,
      auditLog: true,
    },
  };
}

export function normalizeBotConfiguration(
  snapshot: Partial<BotConfigurationBundle> | undefined,
): BotConfigurationBundle {
  const defaults = createDefaultBotConfiguration();

  return {
    ...defaults,
    ...snapshot,
    general: {
      ...defaults.general,
      ...(snapshot?.general ?? {}),
    },
    evolution: {
      ...defaults.evolution,
      ...(snapshot?.evolution ?? {}),
    },
    openai: {
      ...defaults.openai,
      ...(snapshot?.openai ?? {}),
    },
    integrations: {
      ...defaults.integrations,
      ...(snapshot?.integrations ?? {}),
    },
    whatsapp: {
      ...defaults.whatsapp,
      ...(snapshot?.whatsapp ?? {}),
    },
    memory: {
      ...defaults.memory,
      ...(snapshot?.memory ?? {}),
    },
    orchestrator: {
      ...defaults.orchestrator,
      ...(snapshot?.orchestrator ?? {}),
    },
    prompts: (snapshot?.prompts ?? defaults.prompts).map(normalizePromptTemplate),
    tools: snapshot?.tools ?? defaults.tools,
    security: {
      ...defaults.security,
      ...(snapshot?.security ?? {}),
    },
  };
}
