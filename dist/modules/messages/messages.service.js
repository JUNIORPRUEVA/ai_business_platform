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
exports.MessagesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const conversation_entity_1 = require("../conversations/entities/conversation.entity");
const message_entity_1 = require("./entities/message.entity");
let MessagesService = class MessagesService {
    messagesRepository;
    conversationsRepository;
    constructor(messagesRepository, conversationsRepository) {
        this.messagesRepository = messagesRepository;
        this.conversationsRepository = conversationsRepository;
    }
    async list(companyId, conversationId, limit = 50) {
        const conversation = await this.conversationsRepository.findOne({
            where: { id: conversationId },
        });
        if (!conversation)
            throw new common_1.NotFoundException('Conversation not found.');
        if (conversation.companyId !== companyId)
            throw new common_1.ForbiddenException();
        return this.messagesRepository.find({
            where: { conversationId },
            order: { createdAt: 'ASC' },
            take: Math.min(Math.max(limit, 1), 200),
        });
    }
    async createFromUser(companyId, conversationId, dto) {
        return this.create(companyId, conversationId, {
            sender: 'user',
            content: dto.content,
            type: dto.type ?? 'text',
        });
    }
    async create(companyId, conversationId, params) {
        const conversation = await this.conversationsRepository.findOne({ where: { id: conversationId } });
        if (!conversation)
            throw new common_1.NotFoundException('Conversation not found.');
        if (conversation.companyId !== companyId)
            throw new common_1.ForbiddenException();
        const entity = this.messagesRepository.create({
            conversationId,
            sender: params.sender,
            content: params.content,
            type: params.type,
        });
        return this.messagesRepository.save(entity);
    }
};
exports.MessagesService = MessagesService;
exports.MessagesService = MessagesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_entity_1.MessageEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(conversation_entity_1.ConversationEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], MessagesService);
//# sourceMappingURL=messages.service.js.map