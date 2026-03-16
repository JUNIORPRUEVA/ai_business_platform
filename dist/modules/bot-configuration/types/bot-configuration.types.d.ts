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
export declare function createDefaultBotConfiguration(): BotConfigurationBundle;
