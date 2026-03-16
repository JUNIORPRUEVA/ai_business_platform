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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = require("bcryptjs");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("./entities/user.entity");
let UsersService = class UsersService {
    usersRepository;
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async list(companyId) {
        const users = await this.usersRepository.find({
            where: { companyId },
            order: { createdAt: 'DESC' },
        });
        return users.map(({ passwordHash: _ph, ...safe }) => safe);
    }
    async get(companyId, id) {
        const user = await this.usersRepository.findOne({
            where: { id, companyId },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found.');
        }
        const { passwordHash: _ph, ...safe } = user;
        return safe;
    }
    async create(companyId, dto) {
        const entity = this.usersRepository.create({
            companyId,
            name: dto.name,
            email: dto.email.toLowerCase().trim(),
            passwordHash: await bcrypt.hash(dto.password, 12),
            role: dto.role ?? 'operator',
        });
        try {
            const saved = await this.usersRepository.save(entity);
            const { passwordHash: _ph, ...safe } = saved;
            return safe;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
                throw new common_1.ConflictException('Email already exists for this company.');
            }
            throw error;
        }
    }
    async update(companyId, id, dto) {
        const existing = await this.usersRepository.findOne({
            where: { id, companyId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('User not found.');
        }
        if (dto.email !== undefined) {
            existing.email = dto.email.toLowerCase().trim();
        }
        if (dto.name !== undefined) {
            existing.name = dto.name;
        }
        if (dto.role !== undefined) {
            existing.role = dto.role;
        }
        if (dto.password !== undefined) {
            existing.passwordHash = await bcrypt.hash(dto.password, 12);
        }
        try {
            const saved = await this.usersRepository.save(existing);
            const { passwordHash: _ph, ...safe } = saved;
            return safe;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.toLowerCase().includes('unique') || message.toLowerCase().includes('duplicate')) {
                throw new common_1.ConflictException('Email already exists for this company.');
            }
            throw error;
        }
    }
    async remove(companyId, id) {
        const result = await this.usersRepository.delete({ id, companyId });
        if (result.affected === 0) {
            throw new common_1.NotFoundException('User not found.');
        }
        return { deleted: true };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map