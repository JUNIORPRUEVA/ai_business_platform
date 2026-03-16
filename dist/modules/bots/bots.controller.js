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
exports.BotsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_bot_dto_1 = require("./dto/create-bot.dto");
const update_bot_dto_1 = require("./dto/update-bot.dto");
const bots_service_1 = require("./bots.service");
class IdParam {
    id;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], IdParam.prototype, "id", void 0);
let BotsController = class BotsController {
    botsService;
    constructor(botsService) {
        this.botsService = botsService;
    }
    list(user) {
        return this.botsService.list(user.companyId);
    }
    get(user, params) {
        return this.botsService.get(user.companyId, params.id);
    }
    create(user, dto) {
        return this.botsService.create(user.companyId, dto);
    }
    update(user, params, dto) {
        return this.botsService.update(user.companyId, params.id, dto);
    }
    remove(user, params) {
        return this.botsService.remove(user.companyId, params.id);
    }
};
exports.BotsController = BotsController;
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator', 'viewer'),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BotsController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator', 'viewer'),
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam]),
    __metadata("design:returntype", void 0)
], BotsController.prototype, "get", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_bot_dto_1.CreateBotDto]),
    __metadata("design:returntype", void 0)
], BotsController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam, update_bot_dto_1.UpdateBotDto]),
    __metadata("design:returntype", void 0)
], BotsController.prototype, "update", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam]),
    __metadata("design:returntype", void 0)
], BotsController.prototype, "remove", null);
exports.BotsController = BotsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('bots'),
    __metadata("design:paramtypes", [bots_service_1.BotsService])
], BotsController);
//# sourceMappingURL=bots.controller.js.map