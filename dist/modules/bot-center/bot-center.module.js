"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotCenterModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../../common/database/database.module");
const bot_configuration_module_1 = require("../bot-configuration/bot-configuration.module");
const bot_memory_module_1 = require("../bot-memory/bot-memory.module");
const bot_center_controller_1 = require("./controllers/bot-center.controller");
const bot_center_service_1 = require("./services/bot-center.service");
let BotCenterModule = class BotCenterModule {
};
exports.BotCenterModule = BotCenterModule;
exports.BotCenterModule = BotCenterModule = __decorate([
    (0, common_1.Module)({
        imports: [bot_configuration_module_1.BotConfigurationModule, bot_memory_module_1.BotMemoryModule, database_module_1.DatabaseModule],
        controllers: [bot_center_controller_1.BotCenterController],
        providers: [bot_center_service_1.BotCenterService],
        exports: [bot_center_service_1.BotCenterService],
    })
], BotCenterModule);
//# sourceMappingURL=bot-center.module.js.map