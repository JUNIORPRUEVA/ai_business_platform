"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDefaultBotConfiguration = createDefaultBotConfiguration;
function createDefaultBotConfiguration() {
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
            systemPromptPreview: 'Enterprise assistant tuned for sales, support, catalog guidance, and operator-safe escalation.',
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
                description: 'Controls enterprise qualification, memory loading, escalation rules, and tool selection.',
                content: 'You are FULLPOS Bot, an enterprise assistant for WhatsApp operations. Always inspect the current contact context, product knowledge, short-term memory, long-term memory, and operational rules before responding. Prioritize accuracy over speed, never invent billing or contract information, escalate when thresholds are exceeded, and keep the tone concise and professional.',
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
//# sourceMappingURL=bot-configuration.types.js.map