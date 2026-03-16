"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotConfigurationModule = void 0;
const common_1 = require("@nestjs/common");
const persistence_module_1 = require("../../common/persistence/persistence.module");
const bot_configuration_controller_1 = require("./controllers/bot-configuration.controller");
const bot_configuration_service_1 = require("./services/bot-configuration.service");
let BotConfigurationModule = class BotConfigurationModule {
};
exports.BotConfigurationModule = BotConfigurationModule;
exports.BotConfigurationModule = BotConfigurationModule = __decorate([
    (0, common_1.Module)({
        imports: [persistence_module_1.PersistenceModule],
        controllers: [bot_configuration_controller_1.BotConfigurationController],
        providers: [bot_configuration_service_1.BotConfigurationService],
        exports: [bot_configuration_service_1.BotConfigurationService],
    })
], BotConfigurationModule);
//# sourceMappingURL=bot-configuration.module.js.map