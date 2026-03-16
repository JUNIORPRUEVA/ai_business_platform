"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var EvolutionApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionApiService = void 0;
const common_1 = require("@nestjs/common");
let EvolutionApiService = EvolutionApiService_1 = class EvolutionApiService {
    logger = new common_1.Logger(EvolutionApiService_1.name);
    async sendTextMessage(params) {
        const baseUrl = typeof params.channel.config['baseUrl'] === 'string' ? params.channel.config['baseUrl'] : '';
        const apiKey = typeof params.channel.config['apiKey'] === 'string' ? params.channel.config['apiKey'] : '';
        const instance = typeof params.channel.config['instance'] === 'string' ? params.channel.config['instance'] : '';
        if (!baseUrl || !apiKey || !instance) {
            this.logger.warn('Evolution API not configured; skipping outbound send.');
            return { sent: false, provider: 'noop' };
        }
        const url = `${baseUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(instance)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: apiKey,
            },
            body: JSON.stringify({
                number: params.to,
                text: params.text,
            }),
        });
        if (!response.ok) {
            this.logger.error(`Evolution API send failed: ${response.status}`);
            return { sent: false, provider: 'evolution' };
        }
        return { sent: true, provider: 'evolution' };
    }
};
exports.EvolutionApiService = EvolutionApiService;
exports.EvolutionApiService = EvolutionApiService = EvolutionApiService_1 = __decorate([
    (0, common_1.Injectable)()
], EvolutionApiService);
//# sourceMappingURL=evolution-api.service.js.map