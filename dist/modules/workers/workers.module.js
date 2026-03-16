"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkersModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("@nestjs/bullmq");
const ai_module_1 = require("../ai/ai.module");
const bots_module_1 = require("../bots/bots.module");
const channels_module_1 = require("../channels/channels.module");
const prompts_module_1 = require("../prompts/prompts.module");
const messages_module_1 = require("../messages/messages.module");
const conversations_module_1 = require("../conversations/conversations.module");
const message_processing_processor_1 = require("./processors/message-processing.processor");
const evolution_api_service_1 = require("../channels/services/evolution-api.service");
let WorkersModule = class WorkersModule {
};
exports.WorkersModule = WorkersModule;
exports.WorkersModule = WorkersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            bullmq_1.BullModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: async (configService) => ({
                    connection: {
                        host: configService.get('REDIS_HOST') ?? 'localhost',
                        port: Number(configService.get('REDIS_PORT') ?? 6379),
                        password: configService.get('REDIS_PASSWORD') || undefined,
                        tls: (configService.get('REDIS_TLS') ?? 'false') === 'true' ? {} : undefined,
                    },
                }),
            }),
            bullmq_1.BullModule.registerQueue({
                name: 'message-processing',
            }),
            ai_module_1.AiModule,
            bots_module_1.BotsModule,
            channels_module_1.ChannelsModule,
            prompts_module_1.PromptsModule,
            messages_module_1.MessagesModule,
            conversations_module_1.ConversationsModule,
        ],
        providers: [message_processing_processor_1.MessageProcessingProcessor, evolution_api_service_1.EvolutionApiService],
        exports: [bullmq_1.BullModule],
    })
], WorkersModule);
//# sourceMappingURL=workers.module.js.map