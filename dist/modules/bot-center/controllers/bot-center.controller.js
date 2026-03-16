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
exports.BotCenterController = void 0;
const common_1 = require("@nestjs/common");
const send_test_message_dto_1 = require("../dto/send-test-message.dto");
const update_prompt_dto_1 = require("../dto/update-prompt.dto");
const bot_center_service_1 = require("../services/bot-center.service");
let BotCenterController = class BotCenterController {
    botCenterService;
    constructor(botCenterService) {
        this.botCenterService = botCenterService;
    }
    async getOverview(conversationId) {
        return this.botCenterService.getOverview(conversationId);
    }
    getConversations() {
        return this.botCenterService.listConversations();
    }
    getConversationMessages(conversationId) {
        return this.botCenterService.getConversationMessages(conversationId);
    }
    getConversationContext(conversationId) {
        return this.botCenterService.getConversationContext(conversationId);
    }
    async getConversationMemory(conversationId) {
        return this.botCenterService.getConversationMemory(conversationId);
    }
    getTools() {
        return this.botCenterService.listTools();
    }
    getLogs() {
        return this.botCenterService.listLogs();
    }
    getStatus() {
        return this.botCenterService.getStatus();
    }
    getPrompt() {
        return this.botCenterService.getPromptConfig();
    }
    async updatePrompt(payload) {
        return this.botCenterService.updatePromptConfig(payload);
    }
    async sendTestMessage(payload) {
        return this.botCenterService.sendTestMessage(payload);
    }
};
exports.BotCenterController = BotCenterController;
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, common_1.Query)('conversationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BotCenterController.prototype, "getOverview", null);
__decorate([
    (0, common_1.Get)('conversations'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], BotCenterController.prototype, "getConversations", null);
__decorate([
    (0, common_1.Get)('conversations/:id/messages'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Array)
], BotCenterController.prototype, "getConversationMessages", null);
__decorate([
    (0, common_1.Get)('conversations/:id/context'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Object)
], BotCenterController.prototype, "getConversationContext", null);
__decorate([
    (0, common_1.Get)('conversations/:id/memory'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BotCenterController.prototype, "getConversationMemory", null);
__decorate([
    (0, common_1.Get)('tools'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], BotCenterController.prototype, "getTools", null);
__decorate([
    (0, common_1.Get)('logs'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], BotCenterController.prototype, "getLogs", null);
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], BotCenterController.prototype, "getStatus", null);
__decorate([
    (0, common_1.Get)('prompt'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], BotCenterController.prototype, "getPrompt", null);
__decorate([
    (0, common_1.Put)('prompt'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_prompt_dto_1.UpdatePromptDto]),
    __metadata("design:returntype", Promise)
], BotCenterController.prototype, "updatePrompt", null);
__decorate([
    (0, common_1.Post)('test-message'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [send_test_message_dto_1.SendTestMessageDto]),
    __metadata("design:returntype", Promise)
], BotCenterController.prototype, "sendTestMessage", null);
exports.BotCenterController = BotCenterController = __decorate([
    (0, common_1.Controller)('bot-center'),
    __metadata("design:paramtypes", [bot_center_service_1.BotCenterService])
], BotCenterController);
//# sourceMappingURL=bot-center.controller.js.map