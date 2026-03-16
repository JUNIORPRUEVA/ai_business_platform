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
exports.AutomationsController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_automation_dto_1 = require("./dto/create-automation.dto");
const update_automation_dto_1 = require("./dto/update-automation.dto");
const automations_service_1 = require("./automations.service");
class IdParam {
    id;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], IdParam.prototype, "id", void 0);
let AutomationsController = class AutomationsController {
    automationsService;
    constructor(automationsService) {
        this.automationsService = automationsService;
    }
    list(user) {
        return this.automationsService.list(user.companyId);
    }
    get(user, params) {
        return this.automationsService.get(user.companyId, params.id);
    }
    create(user, dto) {
        return this.automationsService.create(user.companyId, dto);
    }
    update(user, params, dto) {
        return this.automationsService.update(user.companyId, params.id, dto);
    }
    remove(user, params) {
        return this.automationsService.remove(user.companyId, params.id);
    }
};
exports.AutomationsController = AutomationsController;
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator', 'viewer'),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator', 'viewer'),
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "get", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_automation_dto_1.CreateAutomationDto]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam, update_automation_dto_1.UpdateAutomationDto]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "update", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IdParam]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "remove", null);
exports.AutomationsController = AutomationsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('automations'),
    __metadata("design:paramtypes", [automations_service_1.AutomationsService])
], AutomationsController);
//# sourceMappingURL=automations.controller.js.map