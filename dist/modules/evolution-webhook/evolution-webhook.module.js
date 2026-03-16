"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionWebhookModule = void 0;
const common_1 = require("@nestjs/common");
const channels_module_1 = require("../channels/channels.module");
const contacts_module_1 = require("../contacts/contacts.module");
const conversations_module_1 = require("../conversations/conversations.module");
const messages_module_1 = require("../messages/messages.module");
const workers_module_1 = require("../workers/workers.module");
const evolution_webhook_controller_1 = require("./controllers/evolution-webhook.controller");
const evolution_webhook_service_1 = require("./services/evolution-webhook.service");
let EvolutionWebhookModule = class EvolutionWebhookModule {
};
exports.EvolutionWebhookModule = EvolutionWebhookModule;
exports.EvolutionWebhookModule = EvolutionWebhookModule = __decorate([
    (0, common_1.Module)({
        imports: [workers_module_1.WorkersModule, channels_module_1.ChannelsModule, contacts_module_1.ContactsModule, conversations_module_1.ConversationsModule, messages_module_1.MessagesModule],
        controllers: [evolution_webhook_controller_1.EvolutionWebhookController],
        providers: [evolution_webhook_service_1.EvolutionWebhookService],
    })
], EvolutionWebhookModule);
//# sourceMappingURL=evolution-webhook.module.js.map