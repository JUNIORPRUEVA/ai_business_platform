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
exports.OpenAiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bot_configuration_service_1 = require("../../bot-configuration/services/bot-configuration.service");
let OpenAiService = class OpenAiService {
    configService;
    botConfigurationService;
    constructor(configService, botConfigurationService) {
        this.configService = configService;
        this.botConfigurationService = botConfigurationService;
    }
    async draftResponse(request) {
        const configuration = this.botConfigurationService.getConfiguration();
        const model = configuration.openai.model;
        const apiKey = configuration.openai.apiKey ||
            this.configService.get('OPENAI_API_KEY') ||
            '';
        const systemPrompt = this.buildSystemPrompt(request.systemPrompt, request.memoryContext);
        if (!this.hasUsableCredentials(apiKey) || !configuration.openai.isEnabled) {
            return this.buildMockDraft(model, systemPrompt, request);
        }
        try {
            const response = await fetch(this.configService.get('OPENAI_API_URL') ??
                'https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    temperature: configuration.openai.temperature,
                    max_tokens: configuration.openai.maxTokens,
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt,
                        },
                        {
                            role: 'user',
                            content: request.message,
                        },
                    ],
                }),
            });
            if (!response.ok) {
                return this.buildMockDraft(model, systemPrompt, request);
            }
            const data = (await response.json());
            const content = data.choices?.[0]?.message?.content?.trim() ||
                this.buildMockDraft(model, systemPrompt, request).content;
            return {
                provider: 'openai',
                model,
                content,
                usedMockFallback: false,
                systemPrompt,
            };
        }
        catch {
            return this.buildMockDraft(model, systemPrompt, request);
        }
    }
    buildSystemPrompt(basePrompt, memoryContext) {
        return `${basePrompt}\n\nMemory context:\n${memoryContext}`;
    }
    hasUsableCredentials(apiKey) {
        return Boolean(apiKey && !apiKey.includes('*') && apiKey.startsWith('sk-'));
    }
    buildMockDraft(model, systemPrompt, request) {
        const sender = request.senderName?.trim() || 'customer';
        return {
            provider: 'mock',
            model,
            content: `Draft a concise reply for ${sender} about ${request.detectedIntent}. ` +
                'Use the stored memory context, answer only with verified product and policy information, and escalate if certainty is low.',
            usedMockFallback: true,
            systemPrompt,
        };
    }
};
exports.OpenAiService = OpenAiService;
exports.OpenAiService = OpenAiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        bot_configuration_service_1.BotConfigurationService])
], OpenAiService);
//# sourceMappingURL=openai.service.js.map