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
exports.ConversationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const channel_entity_1 = require("../channels/entities/channel.entity");
const contact_entity_1 = require("../contacts/entities/contact.entity");
const conversation_entity_1 = require("./entities/conversation.entity");
let ConversationsService = class ConversationsService {
    conversationsRepository;
    channelsRepository;
    contactsRepository;
    constructor(conversationsRepository, channelsRepository, contactsRepository) {
        this.conversationsRepository = conversationsRepository;
        this.channelsRepository = channelsRepository;
        this.contactsRepository = contactsRepository;
    }
    list(companyId) {
        return this.conversationsRepository.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
        });
    }
    async get(companyId, id) {
        const conversation = await this.conversationsRepository.findOne({
            where: { id, companyId },
        });
        if (!conversation)
            throw new common_1.NotFoundException('Conversation not found.');
        return conversation;
    }
    async create(companyId, dto) {
        const channel = await this.channelsRepository.findOne({
            where: { id: dto.channelId, companyId },
        });
        if (!channel)
            throw new common_1.NotFoundException('Channel not found.');
        const contact = await this.contactsRepository.findOne({
            where: { id: dto.contactId, companyId },
        });
        if (!contact)
            throw new common_1.NotFoundException('Contact not found.');
        const entity = this.conversationsRepository.create({
            companyId,
            channelId: channel.id,
            contactId: contact.id,
            status: dto.status ?? 'open',
        });
        return this.conversationsRepository.save(entity);
    }
    async update(companyId, id, dto) {
        const conversation = await this.get(companyId, id);
        const merged = this.conversationsRepository.merge(conversation, dto);
        return this.conversationsRepository.save(merged);
    }
    async remove(companyId, id) {
        const result = await this.conversationsRepository.delete({ id, companyId });
        if (result.affected === 0)
            throw new common_1.NotFoundException('Conversation not found.');
        return { deleted: true };
    }
    async findOrCreateOpen(companyId, channelId, contactId) {
        const existing = await this.conversationsRepository.findOne({
            where: { companyId, channelId, contactId, status: 'open' },
            order: { createdAt: 'DESC' },
        });
        if (existing)
            return existing;
        const entity = this.conversationsRepository.create({
            companyId,
            channelId,
            contactId,
            status: 'open',
        });
        return this.conversationsRepository.save(entity);
    }
};
exports.ConversationsService = ConversationsService;
exports.ConversationsService = ConversationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(conversation_entity_1.ConversationEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(channel_entity_1.ChannelEntity)),
    __param(2, (0, typeorm_1.InjectRepository)(contact_entity_1.ContactEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ConversationsService);
//# sourceMappingURL=conversations.service.js.map