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
exports.MemoryLoaderService = void 0;
const common_1 = require("@nestjs/common");
const bot_memory_service_1 = require("../../bot-memory/services/bot-memory.service");
let MemoryLoaderService = class MemoryLoaderService {
    botMemoryService;
    constructor(botMemoryService) {
        this.botMemoryService = botMemoryService;
    }
    loadAll(params) {
        const memoryContext = this.botMemoryService.buildMemoryContext(params.conversationId);
        const shortTerm = this.withFallback(this.mapMemoryItems(memoryContext.shortTerm), this.loadShortTermMemory(params.senderId, params.detectedIntent));
        const longTerm = this.withFallback(this.mapMemoryItems(memoryContext.longTerm), this.loadLongTermMemory(params.detectedIntent, params.detectedRole));
        const operational = this.withFallback(this.mapMemoryItems(memoryContext.operational), this.loadOperationalMemory(params.detectedIntent, params.configuration));
        return {
            shortTerm,
            longTerm,
            operational,
            combined: [...shortTerm, ...longTerm, ...operational]
                .sort((left, right) => right.relevanceScore - left.relevanceScore)
                .slice(0, 6),
        };
    }
    mapMemoryItems(items) {
        return items.map((item) => ({
            id: item.id,
            scope: item.scope,
            title: item.title,
            content: item.content,
            relevanceScore: item.relevanceScore,
        }));
    }
    withFallback(primary, fallback) {
        return primary.length > 0 ? primary : fallback;
    }
    loadShortTermMemory(senderId, detectedIntent) {
        const items = [
            {
                id: `stm-${senderId}-01`,
                scope: 'shortTerm',
                title: 'Recent sender interaction',
                content: 'The same sender interacted recently and expects continuity instead of a cold restart.',
                relevanceScore: 0.79,
            },
        ];
        if (detectedIntent === 'product_question' || detectedIntent === 'catalog_search') {
            items.push({
                id: `stm-${senderId}-02`,
                scope: 'shortTerm',
                title: 'Catalog follow-up',
                content: 'Previous exchange suggested the sender wants concrete product facts, variants, and availability instead of generic marketing.',
                relevanceScore: 0.93,
            });
        }
        return items;
    }
    loadLongTermMemory(detectedIntent, detectedRole) {
        const items = [
            {
                id: 'ltm-001',
                scope: 'longTerm',
                title: 'Enterprise tone policy',
                content: 'Responses must remain concise, operationally safe, and grounded in approved business data.',
                relevanceScore: 0.76,
            },
        ];
        if (detectedIntent === 'product_question' || detectedIntent === 'catalog_search') {
            items.push({
                id: 'ltm-002',
                scope: 'longTerm',
                title: 'Product knowledge grounding',
                content: 'When answering about products, prefer catalog facts, SKU metadata, supported modules, and declared limitations. Do not invent unavailable features.',
                relevanceScore: 0.97,
            });
        }
        if (detectedRole === 'finance' || detectedIntent === 'billing_question') {
            items.push({
                id: 'ltm-003',
                scope: 'longTerm',
                title: 'Billing posture',
                content: 'Billing replies must stay factual, avoid settlement promises, and escalate disputed balances when necessary.',
                relevanceScore: 0.9,
            });
        }
        return items;
    }
    loadOperationalMemory(detectedIntent, configuration) {
        const items = [
            {
                id: 'opm-001',
                scope: 'operational',
                title: 'Current autonomy mode',
                content: `Runtime is operating in ${configuration.autonomyLevel} autonomy mode with fallback set to ${configuration.fallbackStrategy}.`,
                relevanceScore: 0.81,
            },
        ];
        if (detectedIntent === 'human_handoff') {
            items.push({
                id: 'opm-002',
                scope: 'operational',
                title: 'Escalation rule',
                content: 'Any explicit request for a human operator must be honored without forcing automated loops.',
                relevanceScore: 0.99,
            });
        }
        if (detectedIntent === 'configuration_request') {
            items.push({
                id: 'opm-003',
                scope: 'operational',
                title: 'Admin boundary',
                content: 'Configuration changes require authenticated admin flows; the orchestrator should not apply runtime changes directly from chat.',
                relevanceScore: 0.94,
            });
        }
        return items;
    }
};
exports.MemoryLoaderService = MemoryLoaderService;
exports.MemoryLoaderService = MemoryLoaderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [bot_memory_service_1.BotMemoryService])
], MemoryLoaderService);
//# sourceMappingURL=memory-loader.service.js.map