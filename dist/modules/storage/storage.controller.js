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
exports.StorageController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const presign_upload_dto_1 = require("./dto/presign-upload.dto");
const storage_service_1 = require("./storage.service");
class PresignDownloadQuery {
    key;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PresignDownloadQuery.prototype, "key", void 0);
let StorageController = class StorageController {
    storageService;
    constructor(storageService) {
        this.storageService = storageService;
    }
    presignUpload(user, dto) {
        return this.storageService.presignUpload({
            companyId: user.companyId,
            folder: dto.folder,
            filename: dto.filename,
            contentType: dto.contentType,
        });
    }
    presignDownload(user, query) {
        return this.storageService.presignDownload({
            companyId: user.companyId,
            key: query.key,
        });
    }
};
exports.StorageController = StorageController;
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Post)('presign-upload'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, presign_upload_dto_1.PresignUploadDto]),
    __metadata("design:returntype", void 0)
], StorageController.prototype, "presignUpload", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator', 'viewer'),
    (0, common_1.Get)('presign-download'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, PresignDownloadQuery]),
    __metadata("design:returntype", void 0)
], StorageController.prototype, "presignDownload", null);
exports.StorageController = StorageController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('storage'),
    __metadata("design:paramtypes", [storage_service_1.StorageService])
], StorageController);
//# sourceMappingURL=storage.controller.js.map