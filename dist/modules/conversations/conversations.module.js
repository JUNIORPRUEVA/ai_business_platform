"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const channel_entity_1 = require("../channels/entities/channel.entity");
const contact_entity_1 = require("../contacts/entities/contact.entity");
const conversation_entity_1 = require("./entities/conversation.entity");
const conversations_controller_1 = require("./conversations.controller");
const conversations_service_1 = require("./conversations.service");
let ConversationsModule = class ConversationsModule {
};
exports.ConversationsModule = ConversationsModule;
exports.ConversationsModule = ConversationsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([conversation_entity_1.ConversationEntity, channel_entity_1.ChannelEntity, contact_entity_1.ContactEntity])],
        controllers: [conversations_controller_1.ConversationsController],
        providers: [conversations_service_1.ConversationsService],
        exports: [conversations_service_1.ConversationsService],
    })
], ConversationsModule);
//# sourceMappingURL=conversations.module.js.map