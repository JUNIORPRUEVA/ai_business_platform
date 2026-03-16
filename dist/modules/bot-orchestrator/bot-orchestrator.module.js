"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotOrchestratorModule = void 0;
const common_1 = require("@nestjs/common");
const bot_configuration_module_1 = require("../bot-configuration/bot-configuration.module");
const bot_memory_module_1 = require("../bot-memory/bot-memory.module");
const openai_module_1 = require("../openai/openai.module");
const bot_orchestrator_controller_1 = require("./controllers/bot-orchestrator.controller");
const bot_orchestrator_service_1 = require("./services/bot-orchestrator.service");
const intent_classifier_service_1 = require("./services/intent-classifier.service");
const memory_loader_service_1 = require("./services/memory-loader.service");
const role_resolver_service_1 = require("./services/role-resolver.service");
const tool_decision_service_1 = require("./services/tool-decision.service");
let BotOrchestratorModule = class BotOrchestratorModule {
};
exports.BotOrchestratorModule = BotOrchestratorModule;
exports.BotOrchestratorModule = BotOrchestratorModule = __decorate([
    (0, common_1.Module)({
        imports: [bot_configuration_module_1.BotConfigurationModule, bot_memory_module_1.BotMemoryModule, openai_module_1.OpenAiModule],
        controllers: [bot_orchestrator_controller_1.BotOrchestratorController],
        providers: [
            bot_orchestrator_service_1.BotOrchestratorService,
            intent_classifier_service_1.IntentClassifierService,
            role_resolver_service_1.RoleResolverService,
            memory_loader_service_1.MemoryLoaderService,
            tool_decision_service_1.ToolDecisionService,
        ],
        exports: [bot_orchestrator_service_1.BotOrchestratorService],
    })
], BotOrchestratorModule);
//# sourceMappingURL=bot-orchestrator.module.js.map