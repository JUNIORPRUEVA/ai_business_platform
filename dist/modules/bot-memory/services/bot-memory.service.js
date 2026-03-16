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
exports.BotMemoryService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const json_file_store_service_1 = require("../../../common/persistence/json-file-store.service");
const bot_memory_types_1 = require("../types/bot-memory.types");
let BotMemoryService = class BotMemoryService {
    fileStore;
    state;
    constructor(fileStore) {
        this.fileStore = fileStore;
    }
    async onModuleInit() {
        this.state = await this.fileStore.readOrCreate('bot-memory.json', bot_memory_types_1.createDefaultBotMemoryStore);
    }
    async saveIncomingMessageMemory(input) {
        const record = {
            id: (0, node_crypto_1.randomUUID)(),
            conversationId: input.conversationId,
            senderId: input.senderId,
            channel: input.channel,
            direction: 'incoming',
            content: input.content,
            createdAt: new Date().toISOString(),
            metadata: input.metadata,
        };
        this.state.messageRecords.push(record);
        await this.persist();
        return structuredClone(record);
    }
    async saveOutgoingMessageMemory(input) {
        const record = {
            id: (0, node_crypto_1.randomUUID)(),
            conversationId: input.conversationId,
            senderId: input.senderId,
            channel: input.channel,
            direction: 'outgoing',
            content: input.content,
            createdAt: new Date().toISOString(),
            metadata: input.metadata,
        };
        this.state.messageRecords.push(record);
        await this.persist();
        return structuredClone(record);
    }
    async saveConversationSummary(input) {
        const existingIndex = this.state.conversationSummaries.findIndex((item) => item.conversationId === input.conversationId);
        const record = {
            id: existingIndex === -1
                ? (0, node_crypto_1.randomUUID)()
                : this.state.conversationSummaries[existingIndex].id,
            conversationId: input.conversationId,
            summary: input.summary,
            generatedFromMessages: input.generatedFromMessages,
            updatedAt: new Date().toISOString(),
        };
        if (existingIndex === -1) {
            this.state.conversationSummaries.push(record);
        }
        else {
            this.state.conversationSummaries[existingIndex] = record;
        }
        await this.persist();
        return structuredClone(record);
    }
    async saveOperationalState(input) {
        const existingIndex = this.state.operationalStates.findIndex((item) => item.conversationId === input.conversationId);
        const record = {
            id: existingIndex === -1
                ? (0, node_crypto_1.randomUUID)()
                : this.state.operationalStates[existingIndex].id,
            conversationId: input.conversationId,
            stage: input.stage,
            lastIntent: input.lastIntent,
            assignedTool: input.assignedTool,
            needsHumanEscalation: input.needsHumanEscalation,
            updatedAt: new Date().toISOString(),
        };
        if (existingIndex === -1) {
            this.state.operationalStates.push(record);
        }
        else {
            this.state.operationalStates[existingIndex] = record;
        }
        await this.persist();
        return structuredClone(record);
    }
    getShortTermMemory(conversationId, limit = 12) {
        return this.state.messageRecords
            .filter((item) => item.conversationId === conversationId)
            .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
            .slice(0, limit)
            .map((item, index) => ({
            id: item.id,
            scope: 'shortTerm',
            title: item.direction === 'incoming' ? 'Incoming message' : 'Outgoing draft',
            content: item.content,
            relevanceScore: Math.max(0.55, 0.95 - index * 0.05),
            createdAt: item.createdAt,
        }));
    }
    getLongTermMemory(conversationId) {
        const summary = this.state.conversationSummaries.find((item) => item.conversationId === conversationId);
        const summaryLookup = summary
            ? [
                {
                    id: summary.id,
                    scope: 'longTerm',
                    title: 'Conversation summary',
                    content: summary.summary,
                    relevanceScore: 0.88,
                    createdAt: summary.updatedAt,
                },
            ]
            : [];
        return [...summaryLookup, ...this.state.longTermFacts].map((item) => structuredClone(item));
    }
    getOperationalMemory(conversationId) {
        const state = this.state.operationalStates.find((item) => item.conversationId === conversationId);
        return state ? structuredClone(state) : null;
    }
    buildMemoryContext(conversationId) {
        const shortTerm = this.getShortTermMemory(conversationId);
        const longTerm = this.getLongTermMemory(conversationId);
        const operationalState = this.getOperationalMemory(conversationId);
        const operational = operationalState
            ? [
                {
                    id: operationalState.id,
                    scope: 'operational',
                    title: 'Operational state',
                    content: `Stage=${operationalState.stage}; intent=${operationalState.lastIntent ?? 'unknown'}; tool=${operationalState.assignedTool ?? 'none'}; escalation=${operationalState.needsHumanEscalation}`,
                    relevanceScore: 0.9,
                    createdAt: operationalState.updatedAt,
                },
            ]
            : [];
        const summary = this.state.conversationSummaries.find((item) => item.conversationId === conversationId);
        const formattedContext = [
            'Short-term memory:',
            ...shortTerm.map((item) => `- ${item.content}`),
            'Long-term memory:',
            ...longTerm.map((item) => `- ${item.content}`),
            'Operational memory:',
            ...operational.map((item) => `- ${item.content}`),
        ].join('\n');
        return {
            conversationId,
            shortTerm,
            longTerm,
            operational,
            summary: summary ? structuredClone(summary) : undefined,
            formattedContext,
        };
    }
    getStats() {
        return {
            messageRecords: this.state.messageRecords.length,
            summaries: this.state.conversationSummaries.length,
            operationalStates: this.state.operationalStates.length,
            longTermFacts: this.state.longTermFacts.length,
        };
    }
    async persist() {
        await this.fileStore.write('bot-memory.json', this.state);
    }
};
exports.BotMemoryService = BotMemoryService;
exports.BotMemoryService = BotMemoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [json_file_store_service_1.JsonFileStoreService])
], BotMemoryService);
//# sourceMappingURL=bot-memory.service.js.map