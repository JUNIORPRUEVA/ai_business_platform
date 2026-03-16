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
exports.AutomationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const automation_entity_1 = require("./entities/automation.entity");
let AutomationsService = class AutomationsService {
    automationsRepository;
    constructor(automationsRepository) {
        this.automationsRepository = automationsRepository;
    }
    list(companyId) {
        return this.automationsRepository.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
        });
    }
    async get(companyId, id) {
        const automation = await this.automationsRepository.findOne({ where: { id, companyId } });
        if (!automation)
            throw new common_1.NotFoundException('Automation not found.');
        return automation;
    }
    create(companyId, dto) {
        const entity = this.automationsRepository.create({
            companyId,
            trigger: dto.trigger,
            action: dto.action,
            config: dto.config ?? {},
            status: dto.status ?? 'active',
        });
        return this.automationsRepository.save(entity);
    }
    async update(companyId, id, dto) {
        const automation = await this.get(companyId, id);
        const merged = this.automationsRepository.merge(automation, {
            ...dto,
            config: dto.config ?? automation.config,
        });
        return this.automationsRepository.save(merged);
    }
    async remove(companyId, id) {
        const result = await this.automationsRepository.delete({ id, companyId });
        if (result.affected === 0)
            throw new common_1.NotFoundException('Automation not found.');
        return { deleted: true };
    }
};
exports.AutomationsService = AutomationsService;
exports.AutomationsService = AutomationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(automation_entity_1.AutomationEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AutomationsService);
//# sourceMappingURL=automations.service.js.map