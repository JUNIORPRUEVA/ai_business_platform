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
exports.BotConfigurationService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const json_file_store_service_1 = require("../../../common/persistence/json-file-store.service");
const bot_configuration_types_1 = require("../types/bot-configuration.types");
let BotConfigurationService = class BotConfigurationService {
    fileStore;
    state;
    constructor(fileStore) {
        this.fileStore = fileStore;
    }
    async onModuleInit() {
        this.state = await this.fileStore.readOrCreate('bot-configuration.json', bot_configuration_types_1.createDefaultBotConfiguration);
    }
    getConfiguration() {
        return structuredClone(this.state);
    }
    getPromptById(promptId) {
        const prompt = this.state.prompts.find((item) => item.id === promptId);
        if (!prompt) {
            throw new common_1.NotFoundException(`Prompt ${promptId} was not found.`);
        }
        return structuredClone(prompt);
    }
    getActivePrompt() {
        return structuredClone(this.state.prompts[0]);
    }
    listPrompts() {
        return structuredClone(this.state.prompts);
    }
    listTools() {
        return structuredClone(this.state.tools);
    }
    async updateGeneralSettings(payload) {
        this.state.general = {
            ...this.state.general,
            ...payload,
        };
        await this.persist();
        return structuredClone(this.state.general);
    }
    async updateEvolutionSettings(payload) {
        this.state.evolution = {
            ...this.state.evolution,
            ...payload,
        };
        await this.persist();
        return structuredClone(this.state.evolution);
    }
    async updateOpenAiSettings(payload) {
        this.state.openai = {
            ...this.state.openai,
            ...payload,
        };
        await this.persist();
        return structuredClone(this.state.openai);
    }
    async updateMemorySettings(payload) {
        this.state.memory = {
            ...this.state.memory,
            ...payload,
        };
        await this.persist();
        return structuredClone(this.state.memory);
    }
    async updateOrchestratorSettings(payload) {
        this.state.orchestrator = {
            ...this.state.orchestrator,
            ...payload,
        };
        await this.persist();
        return structuredClone(this.state.orchestrator);
    }
    async updateSecuritySettings(payload) {
        this.state.security = {
            ...this.state.security,
            ...payload,
        };
        await this.persist();
        return structuredClone(this.state.security);
    }
    async createPrompt(payload) {
        const created = {
            id: (0, node_crypto_1.randomUUID)(),
            title: payload.title,
            description: payload.description,
            content: payload.content,
            updatedAt: new Date().toISOString(),
        };
        this.state.prompts.push(created);
        await this.persist();
        return structuredClone(created);
    }
    async updatePrompt(promptId, payload) {
        const index = this.state.prompts.findIndex((item) => item.id === promptId);
        if (index === -1) {
            throw new common_1.NotFoundException(`Prompt ${promptId} was not found.`);
        }
        this.state.prompts[index] = {
            ...this.state.prompts[index],
            ...payload,
            updatedAt: new Date().toISOString(),
        };
        await this.persist();
        return structuredClone(this.state.prompts[index]);
    }
    async deletePrompt(promptId) {
        const nextPrompts = this.state.prompts.filter((item) => item.id !== promptId);
        if (nextPrompts.length === this.state.prompts.length) {
            throw new common_1.NotFoundException(`Prompt ${promptId} was not found.`);
        }
        this.state.prompts = nextPrompts;
        await this.persist();
    }
    async createTool(payload) {
        const created = {
            id: (0, node_crypto_1.randomUUID)(),
            name: payload.name,
            description: payload.description,
            category: payload.category,
            isEnabled: payload.isEnabled,
            intents: payload.intents,
            requiresConfirmation: payload.requiresConfirmation,
        };
        this.state.tools.push(created);
        await this.persist();
        return structuredClone(created);
    }
    async updateTool(toolId, payload) {
        const index = this.state.tools.findIndex((item) => item.id === toolId);
        if (index === -1) {
            throw new common_1.NotFoundException(`Tool ${toolId} was not found.`);
        }
        this.state.tools[index] = {
            ...this.state.tools[index],
            ...payload,
        };
        await this.persist();
        return structuredClone(this.state.tools[index]);
    }
    async deleteTool(toolId) {
        const nextTools = this.state.tools.filter((item) => item.id !== toolId);
        if (nextTools.length === this.state.tools.length) {
            throw new common_1.NotFoundException(`Tool ${toolId} was not found.`);
        }
        this.state.tools = nextTools;
        await this.persist();
    }
    async persist() {
        await this.fileStore.write('bot-configuration.json', this.state);
    }
};
exports.BotConfigurationService = BotConfigurationService;
exports.BotConfigurationService = BotConfigurationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [json_file_store_service_1.JsonFileStoreService])
], BotConfigurationService);
//# sourceMappingURL=bot-configuration.service.js.map