"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_module_1 = require("./common/database/database.module");
const health_controller_1 = require("./common/health/health.controller");
const evolution_webhook_module_1 = require("./modules/evolution-webhook/evolution-webhook.module");
const auth_module_1 = require("./modules/auth/auth.module");
const automations_module_1 = require("./modules/automations/automations.module");
const bots_module_1 = require("./modules/bots/bots.module");
const channels_module_1 = require("./modules/channels/channels.module");
const companies_module_1 = require("./modules/companies/companies.module");
const contacts_module_1 = require("./modules/contacts/contacts.module");
const conversations_module_1 = require("./modules/conversations/conversations.module");
const memory_module_1 = require("./modules/memory/memory.module");
const messages_module_1 = require("./modules/messages/messages.module");
const prompts_module_1 = require("./modules/prompts/prompts.module");
const storage_module_1 = require("./modules/storage/storage.module");
const tools_module_1 = require("./modules/tools/tools.module");
const users_module_1 = require("./modules/users/users.module");
const workers_module_1 = require("./modules/workers/workers.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['.env/backend.env', '.env'],
            }),
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            companies_module_1.CompaniesModule,
            users_module_1.UsersModule,
            bots_module_1.BotsModule,
            channels_module_1.ChannelsModule,
            contacts_module_1.ContactsModule,
            conversations_module_1.ConversationsModule,
            messages_module_1.MessagesModule,
            prompts_module_1.PromptsModule,
            memory_module_1.MemoryModule,
            tools_module_1.ToolsModule,
            automations_module_1.AutomationsModule,
            storage_module_1.StorageModule,
            workers_module_1.WorkersModule,
            evolution_webhook_module_1.EvolutionWebhookModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map