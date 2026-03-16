"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotMemoryModule = void 0;
const common_1 = require("@nestjs/common");
const persistence_module_1 = require("../../common/persistence/persistence.module");
const bot_memory_service_1 = require("./services/bot-memory.service");
let BotMemoryModule = class BotMemoryModule {
};
exports.BotMemoryModule = BotMemoryModule;
exports.BotMemoryModule = BotMemoryModule = __decorate([
    (0, common_1.Module)({
        imports: [persistence_module_1.PersistenceModule],
        providers: [bot_memory_service_1.BotMemoryService],
        exports: [bot_memory_service_1.BotMemoryService],
    })
], BotMemoryModule);
//# sourceMappingURL=bot-memory.module.js.map