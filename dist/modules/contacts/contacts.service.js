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
exports.ContactsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const contact_entity_1 = require("./entities/contact.entity");
let ContactsService = class ContactsService {
    contactsRepository;
    constructor(contactsRepository) {
        this.contactsRepository = contactsRepository;
    }
    list(companyId) {
        return this.contactsRepository.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
        });
    }
    async get(companyId, id) {
        const contact = await this.contactsRepository.findOne({
            where: { id, companyId },
        });
        if (!contact)
            throw new common_1.NotFoundException('Contact not found.');
        return contact;
    }
    create(companyId, dto) {
        const entity = this.contactsRepository.create({
            companyId,
            name: dto.name ?? null,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            tags: dto.tags ?? [],
        });
        return this.contactsRepository.save(entity);
    }
    async update(companyId, id, dto) {
        const contact = await this.get(companyId, id);
        const merged = this.contactsRepository.merge(contact, {
            ...dto,
            tags: dto.tags ?? contact.tags,
        });
        return this.contactsRepository.save(merged);
    }
    async remove(companyId, id) {
        const result = await this.contactsRepository.delete({ id, companyId });
        if (result.affected === 0)
            throw new common_1.NotFoundException('Contact not found.');
        return { deleted: true };
    }
    async findOrCreateByPhone(companyId, phone, name) {
        const normalizedPhone = phone.trim();
        const existing = await this.contactsRepository.findOne({
            where: { companyId, phone: normalizedPhone },
        });
        if (existing) {
            if (name && !existing.name) {
                existing.name = name;
                return this.contactsRepository.save(existing);
            }
            return existing;
        }
        const created = this.contactsRepository.create({
            companyId,
            phone: normalizedPhone,
            name: name ?? null,
            email: null,
            tags: [],
        });
        return this.contactsRepository.save(created);
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(contact_entity_1.ContactEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map