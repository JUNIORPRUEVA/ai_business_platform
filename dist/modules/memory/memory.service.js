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
exports.MemoryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const contact_entity_1 = require("../contacts/entities/contact.entity");
const memory_entity_1 = require("./entities/memory.entity");
let MemoryService = class MemoryService {
    memoryRepository;
    contactsRepository;
    constructor(memoryRepository, contactsRepository) {
        this.memoryRepository = memoryRepository;
        this.contactsRepository = contactsRepository;
    }
    list(companyId) {
        return this.memoryRepository.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
            take: 200,
        });
    }
    async get(companyId, id) {
        const memory = await this.memoryRepository.findOne({ where: { id, companyId } });
        if (!memory)
            throw new common_1.NotFoundException('Memory entry not found.');
        return memory;
    }
    async create(companyId, dto) {
        const contact = await this.contactsRepository.findOne({
            where: { id: dto.contactId, companyId },
        });
        if (!contact)
            throw new common_1.NotFoundException('Contact not found.');
        const entity = this.memoryRepository.create({
            companyId,
            contactId: contact.id,
            type: dto.type,
            content: dto.content,
        });
        return this.memoryRepository.save(entity);
    }
    async update(companyId, id, dto) {
        const memory = await this.get(companyId, id);
        const merged = this.memoryRepository.merge(memory, dto);
        return this.memoryRepository.save(merged);
    }
    async remove(companyId, id) {
        const result = await this.memoryRepository.delete({ id, companyId });
        if (result.affected === 0)
            throw new common_1.NotFoundException('Memory entry not found.');
        return { deleted: true };
    }
    async listForContact(companyId, contactId) {
        return this.memoryRepository.find({
            where: { companyId, contactId },
            order: { createdAt: 'DESC' },
            take: 100,
        });
    }
};
exports.MemoryService = MemoryService;
exports.MemoryService = MemoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(memory_entity_1.MemoryEntity)),
    __param(1, (0, typeorm_1.InjectRepository)(contact_entity_1.ContactEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], MemoryService);
//# sourceMappingURL=memory.service.js.map