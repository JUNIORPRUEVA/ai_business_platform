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
exports.MessageProcessingProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const ai_service_1 = require("../../ai/ai.service");
const bots_service_1 = require("../../bots/bots.service");
const channels_service_1 = require("../../channels/channels.service");
const evolution_api_service_1 = require("../../channels/services/evolution-api.service");
const conversations_service_1 = require("../../conversations/conversations.service");
const messages_service_1 = require("../../messages/messages.service");
const prompts_service_1 = require("../../prompts/prompts.service");
let MessageProcessingProcessor = class MessageProcessingProcessor extends bullmq_1.WorkerHost {
    aiService;
    botsService;
    channelsService;
    promptsService;
    messagesService;
    conversationsService;
    evolutionApiService;
    constructor(aiService, botsService, channelsService, promptsService, messagesService, conversationsService, evolutionApiService) {
        super();
        this.aiService = aiService;
        this.botsService = botsService;
        this.channelsService = channelsService;
        this.promptsService = promptsService;
        this.messagesService = messagesService;
        this.conversationsService = conversationsService;
        this.evolutionApiService = evolutionApiService;
    }
    async process(job) {
        const { companyId, channelId, conversationId, contactPhone } = job.data;
        await this.conversationsService.get(companyId, conversationId);
        const channel = await this.channelsService.get(companyId, channelId);
        const bot = await this.botsService.getDefaultActiveBot(companyId);
        const systemPrompt = (await this.promptsService.getActiveSystemPrompt(companyId)) ??
            'Eres un bot conversacional empresarial. Responde de forma clara y profesional.';
        const recent = await this.messagesService.list(companyId, conversationId, 20);
        const history = recent
            .filter((m) => m.sender === 'user' || m.sender === 'bot' || m.sender === 'client')
            .map((m) => ({
            role: m.sender === 'bot' ? 'assistant' : 'user',
            content: m.content,
        }));
        const lastUserMessage = recent.length > 0 ? recent[recent.length - 1]?.content : '';
        const draft = await this.aiService.draftReply({
            model: bot.model,
            temperature: bot.temperature,
            systemPrompt,
            userMessage: lastUserMessage ?? '',
            history,
        });
        const botMessage = await this.messagesService.create(companyId, conversationId, {
            sender: 'bot',
            content: draft.content,
            type: 'text',
        });
        if (channel.type === 'whatsapp') {
            await this.evolutionApiService.sendTextMessage({
                channel,
                to: contactPhone,
                text: botMessage.content,
            });
        }
        return { ok: true };
    }
};
exports.MessageProcessingProcessor = MessageProcessingProcessor;
exports.MessageProcessingProcessor = MessageProcessingProcessor = __decorate([
    (0, bullmq_1.Processor)('message-processing'),
    __metadata("design:paramtypes", [ai_service_1.AiService,
        bots_service_1.BotsService,
        channels_service_1.ChannelsService,
        prompts_service_1.PromptsService,
        messages_service_1.MessagesService,
        conversations_service_1.ConversationsService,
        evolution_api_service_1.EvolutionApiService])
], MessageProcessingProcessor);
//# sourceMappingURL=message-processing.processor.js.map