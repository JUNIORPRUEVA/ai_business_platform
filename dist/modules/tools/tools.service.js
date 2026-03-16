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
exports.ToolsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tool_entity_1 = require("./entities/tool.entity");
let ToolsService = class ToolsService {
    toolsRepository;
    constructor(toolsRepository) {
        this.toolsRepository = toolsRepository;
    }
    list(companyId) {
        return this.toolsRepository.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
        });
    }
    async get(companyId, id) {
        const tool = await this.toolsRepository.findOne({ where: { id, companyId } });
        if (!tool)
            throw new common_1.NotFoundException('Tool not found.');
        return tool;
    }
    create(companyId, dto) {
        const entity = this.toolsRepository.create({
            companyId,
            name: dto.name,
            type: dto.type,
            config: dto.config ?? {},
            active: dto.active ?? true,
        });
        return this.toolsRepository.save(entity);
    }
    async update(companyId, id, dto) {
        const tool = await this.get(companyId, id);
        const merged = this.toolsRepository.merge(tool, {
            ...dto,
            config: dto.config ?? tool.config,
        });
        return this.toolsRepository.save(merged);
    }
    async remove(companyId, id) {
        const result = await this.toolsRepository.delete({ id, companyId });
        if (result.affected === 0)
            throw new common_1.NotFoundException('Tool not found.');
        return { deleted: true };
    }
};
exports.ToolsService = ToolsService;
exports.ToolsService = ToolsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tool_entity_1.ToolEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ToolsService);
//# sourceMappingURL=tools.service.js.map