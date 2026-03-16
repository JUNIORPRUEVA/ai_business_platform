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
exports.EvolutionMessageWebhookDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class EvolutionWebhookKeyDto {
    remoteJid;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EvolutionWebhookKeyDto.prototype, "remoteJid", void 0);
class EvolutionWebhookDataDto {
    key;
    pushName;
    message;
    text;
    messageTimestamp;
}
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => EvolutionWebhookKeyDto),
    __metadata("design:type", EvolutionWebhookKeyDto)
], EvolutionWebhookDataDto.prototype, "key", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EvolutionWebhookDataDto.prototype, "pushName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], EvolutionWebhookDataDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EvolutionWebhookDataDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EvolutionWebhookDataDto.prototype, "messageTimestamp", void 0);
class EvolutionMessageWebhookDto {
    event;
    instance;
    data;
}
exports.EvolutionMessageWebhookDto = EvolutionMessageWebhookDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EvolutionMessageWebhookDto.prototype, "event", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EvolutionMessageWebhookDto.prototype, "instance", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => EvolutionWebhookDataDto),
    __metadata("design:type", EvolutionWebhookDataDto)
], EvolutionMessageWebhookDto.prototype, "data", void 0);
//# sourceMappingURL=evolution-message-webhook.dto.js.map