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
exports.BotsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bot_entity_1 = require("./entities/bot.entity");
let BotsService = class BotsService {
    botsRepository;
    constructor(botsRepository) {
        this.botsRepository = botsRepository;
    }
    list(companyId) {
        return this.botsRepository.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
        });
    }
    async get(companyId, id) {
        const bot = await this.botsRepository.findOne({ where: { id, companyId } });
        if (!bot)
            throw new common_1.NotFoundException('Bot not found.');
        return bot;
    }
    create(companyId, dto) {
        const entity = this.botsRepository.create({
            companyId,
            name: dto.name,
            model: dto.model ?? 'gpt-4o-mini',
            temperature: dto.temperature ?? 0.2,
            status: dto.status ?? 'active',
        });
        return this.botsRepository.save(entity);
    }
    async update(companyId, id, dto) {
        const bot = await this.get(companyId, id);
        const merged = this.botsRepository.merge(bot, dto);
        return this.botsRepository.save(merged);
    }
    async remove(companyId, id) {
        const result = await this.botsRepository.delete({ id, companyId });
        if (result.affected === 0)
            throw new common_1.NotFoundException('Bot not found.');
        return { deleted: true };
    }
    async getDefaultActiveBot(companyId) {
        const bot = await this.botsRepository.findOne({
            where: { companyId, status: 'active' },
            order: { createdAt: 'ASC' },
        });
        if (!bot) {
            throw new common_1.NotFoundException('No active bot configured for this company.');
        }
        return bot;
    }
};
exports.BotsService = BotsService;
exports.BotsService = BotsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(bot_entity_1.BotEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], BotsService);
//# sourceMappingURL=bots.service.js.map