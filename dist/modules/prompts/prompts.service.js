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
exports.PromptsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const prompt_entity_1 = require("./entities/prompt.entity");
let PromptsService = class PromptsService {
    promptsRepository;
    constructor(promptsRepository) {
        this.promptsRepository = promptsRepository;
    }
    list(companyId) {
        return this.promptsRepository.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
        });
    }
    async get(companyId, id) {
        const prompt = await this.promptsRepository.findOne({ where: { id, companyId } });
        if (!prompt)
            throw new common_1.NotFoundException('Prompt not found.');
        return prompt;
    }
    create(companyId, dto) {
        const entity = this.promptsRepository.create({
            companyId,
            name: dto.name,
            type: dto.type,
            content: dto.content,
            active: dto.active ?? true,
        });
        return this.promptsRepository.save(entity);
    }
    async update(companyId, id, dto) {
        const prompt = await this.get(companyId, id);
        const merged = this.promptsRepository.merge(prompt, dto);
        return this.promptsRepository.save(merged);
    }
    async remove(companyId, id) {
        const result = await this.promptsRepository.delete({ id, companyId });
        if (result.affected === 0)
            throw new common_1.NotFoundException('Prompt not found.');
        return { deleted: true };
    }
    async getActiveSystemPrompt(companyId) {
        const prompt = await this.promptsRepository.findOne({
            where: { companyId, type: 'system', active: true },
            order: { createdAt: 'DESC' },
        });
        return prompt?.content ?? null;
    }
};
exports.PromptsService = PromptsService;
exports.PromptsService = PromptsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(prompt_entity_1.PromptEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], PromptsService);
//# sourceMappingURL=prompts.service.js.map