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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotConfigurationController = void 0;
const common_1 = require("@nestjs/common");
const create_prompt_template_dto_1 = require("../dto/create-prompt-template.dto");
const create_tool_dto_1 = require("../dto/create-tool.dto");
const update_evolution_settings_dto_1 = require("../dto/update-evolution-settings.dto");
const update_general_settings_dto_1 = require("../dto/update-general-settings.dto");
const update_memory_settings_dto_1 = require("../dto/update-memory-settings.dto");
const update_openai_settings_dto_1 = require("../dto/update-openai-settings.dto");
const update_orchestrator_settings_dto_1 = require("../dto/update-orchestrator-settings.dto");
const update_prompt_template_dto_1 = require("../dto/update-prompt-template.dto");
const update_security_settings_dto_1 = require("../dto/update-security-settings.dto");
const update_tool_dto_1 = require("../dto/update-tool.dto");
const bot_configuration_service_1 = require("../services/bot-configuration.service");
let BotConfigurationController = class BotConfigurationController {
    botConfigurationService;
    constructor(botConfigurationService) {
        this.botConfigurationService = botConfigurationService;
    }
    getConfiguration() {
        return this.botConfigurationService.getConfiguration();
    }
    updateGeneral(payload) {
        return this.botConfigurationService.updateGeneralSettings(payload);
    }
    updateEvolution(payload) {
        return this.botConfigurationService.updateEvolutionSettings(payload);
    }
    updateOpenAi(payload) {
        return this.botConfigurationService.updateOpenAiSettings(payload);
    }
    updateMemory(payload) {
        return this.botConfigurationService.updateMemorySettings(payload);
    }
    updateOrchestrator(payload) {
        return this.botConfigurationService.updateOrchestratorSettings(payload);
    }
    updateSecurity(payload) {
        return this.botConfigurationService.updateSecuritySettings(payload);
    }
    listPrompts() {
        return this.botConfigurationService.listPrompts();
    }
    createPrompt(payload) {
        return this.botConfigurationService.createPrompt(payload);
    }
    updatePrompt(promptId, payload) {
        return this.botConfigurationService.updatePrompt(promptId, payload);
    }
    deletePrompt(promptId) {
        return this.botConfigurationService.deletePrompt(promptId);
    }
    listTools() {
        return this.botConfigurationService.listTools();
    }
    createTool(payload) {
        return this.botConfigurationService.createTool(payload);
    }
    updateTool(toolId, payload) {
        return this.botConfigurationService.updateTool(toolId, payload);
    }
    deleteTool(toolId) {
        return this.botConfigurationService.deleteTool(toolId);
    }
};
exports.BotConfigurationController = BotConfigurationController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], BotConfigurationController.prototype, "getConfiguration", null);
__decorate([
    (0, common_1.Put)('general'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_general_settings_dto_1.UpdateGeneralSettingsDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "updateGeneral", null);
__decorate([
    (0, common_1.Put)('evolution'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_evolution_settings_dto_1.UpdateEvolutionSettingsDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "updateEvolution", null);
__decorate([
    (0, common_1.Put)('openai'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_openai_settings_dto_1.UpdateOpenAiSettingsDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "updateOpenAi", null);
__decorate([
    (0, common_1.Put)('memory'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_memory_settings_dto_1.UpdateMemorySettingsDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "updateMemory", null);
__decorate([
    (0, common_1.Put)('orchestrator'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_orchestrator_settings_dto_1.UpdateOrchestratorSettingsDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "updateOrchestrator", null);
__decorate([
    (0, common_1.Put)('security'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_security_settings_dto_1.UpdateSecuritySettingsDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "updateSecurity", null);
__decorate([
    (0, common_1.Get)('prompts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], BotConfigurationController.prototype, "listPrompts", null);
__decorate([
    (0, common_1.Post)('prompts'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_prompt_template_dto_1.CreatePromptTemplateDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "createPrompt", null);
__decorate([
    (0, common_1.Put)('prompts/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_prompt_template_dto_1.UpdatePromptTemplateDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "updatePrompt", null);
__decorate([
    (0, common_1.Delete)('prompts/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "deletePrompt", null);
__decorate([
    (0, common_1.Get)('tools'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], BotConfigurationController.prototype, "listTools", null);
__decorate([
    (0, common_1.Post)('tools'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_tool_dto_1.CreateToolDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "createTool", null);
__decorate([
    (0, common_1.Put)('tools/:id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_tool_dto_1.UpdateToolDto]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "updateTool", null);
__decorate([
    (0, common_1.Delete)('tools/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BotConfigurationController.prototype, "deleteTool", null);
exports.BotConfigurationController = BotConfigurationController = __decorate([
    (0, common_1.Controller)('bot-configuration'),
    __metadata("design:paramtypes", [bot_configuration_service_1.BotConfigurationService])
], BotConfigurationController);
//# sourceMappingURL=bot-configuration.controller.js.map