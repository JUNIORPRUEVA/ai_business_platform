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

export interface MemorySettings {
  enableShortTermMemory: boolean;
  enableLongTermMemory: boolean;
  enableOperationalMemory: boolean;
  recentMessageWindowSize: number;
  automaticSummarization: boolean;
  memoryTtl: string;
  useRedis: boolean;
  usePostgreSql: boolean;
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
      isEnabled: true,
    },
    openai: {
      apiKey: '',
      model: process.env.OPENAI_MODEL ?? 'gpt-5.4-mini',
      temperature: 0.2,
      maxTokens: 1400,
      isEnabled: true,
      systemPromptPreview:
        'Enterprise assistant tuned for sales, support, catalog guidance, and operator-safe escalation.',
    },
    memory: {
      enableShortTermMemory: true,
      enableLongTermMemory: true,
      enableOperationalMemory: true,
      recentMessageWindowSize: 20,
      automaticSummarization: true,
      memoryTtl: '30d',
      useRedis: false,
      usePostgreSql: false,
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
          'You are FULLPOS Bot, an enterprise assistant for WhatsApp operations. Always inspect the current contact context, product knowledge, short-term memory, long-term memory, and operational rules before responding. Prioritize accuracy over speed, never invent billing or contract information, escalate when thresholds are exceeded, and keep the tone concise and professional.',
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