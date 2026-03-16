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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const bcrypt = require("bcryptjs");
const typeorm_2 = require("typeorm");
const company_entity_1 = require("../companies/entities/company.entity");
const user_entity_1 = require("../users/entities/user.entity");
let AuthService = class AuthService {
    dataSource;
    jwtService;
    usersRepository;
    constructor(dataSource, jwtService, usersRepository) {
        this.dataSource = dataSource;
        this.jwtService = jwtService;
        this.usersRepository = usersRepository;
    }
    async registerCompany(dto) {
        return this.dataSource.transaction(async (manager) => {
            const companiesRepo = manager.getRepository(company_entity_1.CompanyEntity);
            const usersRepo = manager.getRepository(user_entity_1.UserEntity);
            const company = companiesRepo.create({
                name: dto.companyName,
                plan: dto.plan ?? 'starter',
                status: 'active',
            });
            await companiesRepo.save(company);
            const email = dto.adminEmail.toLowerCase().trim();
            const already = await usersRepo.findOne({
                where: { companyId: company.id, email },
            });
            if (already) {
                throw new common_1.ConflictException('Admin email is already registered for this company.');
            }
            const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
            const adminUser = usersRepo.create({
                companyId: company.id,
                name: dto.adminName,
                email,
                passwordHash,
                role: 'admin',
            });
            await usersRepo.save(adminUser);
            const accessToken = this.signToken({
                sub: adminUser.id,
                companyId: company.id,
                role: adminUser.role,
                email: adminUser.email,
                name: adminUser.name,
            });
            const { passwordHash: _ph, ...safeUser } = adminUser;
            return { company, adminUser: safeUser, accessToken };
        });
    }
    async login(dto) {
        const user = await this.usersRepository.findOne({
            where: {
                companyId: dto.companyId,
                email: dto.email.toLowerCase().trim(),
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials.');
        }
        const ok = await bcrypt.compare(dto.password, user.passwordHash);
        if (!ok) {
            throw new common_1.UnauthorizedException('Invalid credentials.');
        }
        const accessToken = this.signToken({
            sub: user.id,
            companyId: user.companyId,
            role: user.role,
            email: user.email,
            name: user.name,
        });
        return { accessToken };
    }
    signToken(payload) {
        return this.jwtService.sign(payload);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.UserEntity)),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        jwt_1.JwtService,
        typeorm_2.Repository])
], AuthService);
//# sourceMappingURL=auth.service.js.map