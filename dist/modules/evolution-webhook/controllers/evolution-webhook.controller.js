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
exports.EvolutionWebhookController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const evolution_message_webhook_dto_1 = require("../dto/evolution-message-webhook.dto");
const evolution_webhook_service_1 = require("../services/evolution-webhook.service");
class EvolutionWebhookParams {
    channelId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], EvolutionWebhookParams.prototype, "channelId", void 0);
let EvolutionWebhookController = class EvolutionWebhookController {
    evolutionWebhookService;
    constructor(evolutionWebhookService) {
        this.evolutionWebhookService = evolutionWebhookService;
    }
    processMessages(params, webhookToken, payload) {
        return this.evolutionWebhookService.processIncomingMessage({
            channelId: params.channelId,
            webhookToken,
            payload,
        });
    }
};
exports.EvolutionWebhookController = EvolutionWebhookController;
__decorate([
    (0, common_1.Post)(':channelId/messages'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Headers)('x-webhook-token')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [EvolutionWebhookParams, Object, evolution_message_webhook_dto_1.EvolutionMessageWebhookDto]),
    __metadata("design:returntype", void 0)
], EvolutionWebhookController.prototype, "processMessages", null);
exports.EvolutionWebhookController = EvolutionWebhookController = __decorate([
    (0, common_1.Controller)('webhooks/evolution'),
    __metadata("design:paramtypes", [evolution_webhook_service_1.EvolutionWebhookService])
], EvolutionWebhookController);
//# sourceMappingURL=evolution-webhook.controller.js.map