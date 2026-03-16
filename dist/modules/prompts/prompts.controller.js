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
exports.PromptsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_prompt_dto_1 = require("./dto/create-prompt.dto");
const update_prompt_dto_1 = require("./dto/update-prompt.dto");
const prompts_service_1 = require("./prompts.service");
class IdParam {
    id;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], IdParam.prototype, "id", void 0);
let PromptsController = class PromptsController {
    promptsService;
    constructor(promptsService) {
        this.promptsService = promptsService;
    }
    list(user) {
        return this.promptsService.list(user.companyId);
    }
    get(user, params) {
        return this.promptsService.get(user.companyId, params.id);
    }
    create(user, dto) {
        return this.promptsService.create(user.companyId, dto);
    }
    update(user, params, dto) {
        return this.promptsService.update(user.companyId, params.id, dto);
    }
    remove(user, params) {
        return this.promptsService.remove(user.companyId, params.id);
    }
};
exports.PromptsController = PromptsController;
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator', 'viewer'),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PromptsController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator', 'viewer'),
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam]),
    __metadata("design:returntype", void 0)
], PromptsController.prototype, "get", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_prompt_dto_1.CreatePromptDto]),
    __metadata("design:returntype", void 0)
], PromptsController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam, update_prompt_dto_1.UpdatePromptDto]),
    __metadata("design:returntype", void 0)
], PromptsController.prototype, "update", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam]),
    __metadata("design:returntype", void 0)
], PromptsController.prototype, "remove", null);
exports.PromptsController = PromptsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('prompts'),
    __metadata("design:paramtypes", [prompts_service_1.PromptsService])
], PromptsController);
//# sourceMappingURL=prompts.controller.js.map