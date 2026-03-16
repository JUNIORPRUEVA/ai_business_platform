"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const bot_configuration_service_1 = require("../../bot-configuration/services/bot-configuration.service");
const bot_memory_service_1 = require("../../bot-memory/services/bot-memory.service");
const openai_service_1 = require("../../openai/services/openai.service");
const intent_classifier_service_1 = require("./intent-classifier.service");
const memory_loader_service_1 = require("./memory-loader.service");
const role_resolver_service_1 = require("./role-resolver.service");
const tool_decision_service_1 = require("./tool-decision.service");
let BotOrchestratorService = class BotOrchestratorService {
    botConfigurationService;
    botMemoryService;
    openAiService;
    roleResolverService;
    memoryLoaderService;
    intentClassifierService;
    toolDecisionService;
    constructor(botConfigurationService, botMemoryService, openAiService, roleResolverService, memoryLoaderService, intentClassifierService, toolDecisionService) {
        this.botConfigurationService = botConfigurationService;
        this.botMemoryService = botMemoryService;
        this.openAiService = openAiService;
        this.roleResolverService = roleResolverService;
        this.memoryLoaderService = memoryLoaderService;
        this.intentClassifierService = intentClassifierService;
        this.toolDecisionService = toolDecisionService;
    }
    async processIncomingMessage(payload) {
        const logs = [];
        const timestamp = payload.timestamp ?? new Date().toISOString();
        const senderLabel = payload.senderName?.trim() || payload.senderId;
        const conversationId = payload.senderId;
        this.appendLog(logs, 'ingress', 'Incoming message accepted.', `${payload.channel}:${senderLabel}`);
        const configurationBundle = this.botConfigurationService.getConfiguration();
        const configuration = this.mapRuntimeConfiguration(configurationBundle, payload.channel);
        this.appendLog(logs, 'configuration', 'Active configuration loaded.', `Autonomy=${configuration.autonomyLevel}; tools=${configuration.enabledTools.filter((tool) => tool.active).length}`, timestamp);
        const role = this.roleResolverService.resolve(payload);
        this.appendLog(logs, 'role-resolution', `Role detected as ${role.detectedRole}.`, `source=${role.source}; confidence=${role.confidence.toFixed(2)}`, timestamp);
        const intent = this.intentClassifierService.classify(payload, role.detectedRole);
        this.appendLog(logs, 'intent-classification', `Intent classified as ${intent.intent}.`, `confidence=${intent.confidence.toFixed(2)}; rationale=${intent.rationale}`, timestamp);
        const memory = this.memoryLoaderService.loadAll({
            conversationId,
            senderId: payload.senderId,
            detectedIntent: intent.intent,
            detectedRole: role.detectedRole,
            configuration,
        });
        this.appendLog(logs, 'memory-loading', 'Memory layers loaded.', `short=${memory.shortTerm.length}; long=${memory.longTerm.length}; operational=${memory.operational.length}`, timestamp);
        const decision = this.toolDecisionService.decide({
            detectedIntent: intent.intent,
            configuration,
            memory,
        });
        this.appendLog(logs, 'decision', `Selected action is ${decision.selectedAction}.`, `tool=${decision.selectedTool ?? 'none'}; escalation=${decision.needsHumanEscalation}`, timestamp);
        const responseDraft = await this.buildResponseDraft({
            payload,
            configuration,
            configurationBundle,
            memoryContext: memory,
            detectedRole: role.detectedRole,
            detectedIntent: intent.intent,
            selectedAction: decision.selectedAction,
            selectedTool: decision.selectedTool,
            needsHumanEscalation: decision.needsHumanEscalation,
        });
        this.appendLog(logs, 'response-planning', 'Response plan prepared.', `strategy=${decision.promptStrategy}`, timestamp);
        await this.botMemoryService.saveOperationalState({
            conversationId,
            stage: decision.selectedAction,
            lastIntent: intent.intent,
            assignedTool: decision.selectedTool,
            needsHumanEscalation: decision.needsHumanEscalation,
        });
        if (memory.shortTerm.length >= 2 && configurationBundle.memory.automaticSummarization) {
            await this.botMemoryService.saveConversationSummary({
                conversationId,
                generatedFromMessages: memory.shortTerm.length,
                summary: `Latest intent=${intent.intent}; recent context=${memory.shortTerm
                    .slice(0, 3)
                    .map((item) => item.content)
                    .join(' | ')}`,
            });
        }
        return {
            detectedRole: role.detectedRole,
            detectedIntent: intent.intent,
            memoryUsed: memory.combined,
            selectedAction: decision.selectedAction,
            selectedTool: decision.selectedTool,
            promptStrategy: decision.promptStrategy,
            responseDraft,
            needsHumanEscalation: decision.needsHumanEscalation,
            logs,
        };
    }
    mapRuntimeConfiguration(configurationBundle, channel) {
        return {
            active: configurationBundle.general.isEnabled,
            defaultLanguage: configurationBundle.general.defaultLanguage,
            allowDirectResponses: configurationBundle.orchestrator.automaticMode,
            allowAiResponses: configurationBundle.openai.isEnabled,
            allowToolExecution: configurationBundle.orchestrator.enableToolExecution,
            allowAutoEscalation: configurationBundle.orchestrator.assistedMode,
            autonomyLevel: configurationBundle.orchestrator.autonomyLevel,
            fallbackStrategy: configurationBundle.orchestrator.fallbackStrategy,
            preferredPromptStrategy: 'knowledge-grounded-ai',
            enabledTools: configurationBundle.tools.map((tool) => ({
                id: tool.id,
                name: tool.name,
                description: tool.description,
                intents: tool.intents,
                requiresConfirmation: tool.requiresConfirmation,
                active: tool.isEnabled && channel.toLowerCase() !== 'instagram',
            })),
        };
    }
    async buildResponseDraft(params) {
        const senderName = params.payload.senderName?.trim() || 'customer';
        switch (params.selectedAction) {
            case 'answer_directly':
                return `Acknowledge ${senderName} and continue in ${params.configuration.defaultLanguage} with a short greeting plus a clarifying question.`;
            case 'use_tool':
                return `Prepare ${params.selectedTool} with sender=${params.payload.senderId}, intent=${params.detectedIntent}, then generate a grounded reply for ${senderName} using the returned business data.`;
            case 'use_ai': {
                const draft = await this.openAiService.draftResponse({
                    senderName,
                    message: params.payload.message,
                    detectedIntent: params.detectedIntent,
                    systemPrompt: params.configurationBundle.prompts[0]?.content ||
                        params.configurationBundle.openai.systemPromptPreview,
                    memoryContext: params.memoryContext.combined
                        .map((item) => `${item.title}: ${item.content}`)
                        .join('\n'),
                });
                return draft.content;
            }
            case 'escalate':
                return params.needsHumanEscalation
                    ? `Acknowledge ${senderName}, explain that a human specialist will continue the case, and attach a concise internal handoff summary.`
                    : `Keep the response minimal and request human review before continuing.`;
        }
    }
    appendLog(logs, stage, summary, details, timestamp = new Date().toISOString()) {
        logs.push({
            timestamp,
            stage,
            summary,
            details,
        });
    }
};
exports.BotOrchestratorService = BotOrchestratorService;
exports.BotOrchestratorService = BotOrchestratorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bot_configuration_service_1.BotConfigurationService,
        bot_memory_service_1.BotMemoryService,
        openai_service_1.OpenAiService,
        role_resolver_service_1.RoleResolverService,
        memory_loader_service_1.MemoryLoaderService,
        intent_classifier_service_1.IntentClassifierService,
        tool_decision_service_1.ToolDecisionService])
], BotOrchestratorService);
//# sourceMappingURL=bot-orchestrator.service.js.map