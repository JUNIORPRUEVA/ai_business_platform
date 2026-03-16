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
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let AiService = class AiService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    async draftReply(params) {
        const apiKey = this.configService.get('OPENAI_API_KEY') ?? '';
        const apiUrl = this.configService.get('OPENAI_API_URL') ?? 'https://api.openai.com/v1/chat/completions';
        if (!apiKey || !apiKey.startsWith('sk-')) {
            return {
                provider: 'mock',
                content: 'Gracias por tu mensaje. Un asesor te responderá en breve.',
            };
        }
        const messages = [
            { role: 'system', content: params.systemPrompt },
        ];
        for (const item of params.history ?? []) {
            messages.push({ role: item.role, content: item.content });
        }
        messages.push({ role: 'user', content: params.userMessage });
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: params.model,
                temperature: params.temperature,
                messages,
            }),
        });
        if (!response.ok) {
            return {
                provider: 'mock',
                content: 'Recibido. En este momento estoy teniendo dificultades para responder automáticamente.',
            };
        }
        const data = (await response.json());
        const content = data.choices?.[0]?.message?.content?.trim();
        return {
            provider: 'openai',
            content: content && content.length > 0 ? content : 'Ok, entendido.',
        };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map