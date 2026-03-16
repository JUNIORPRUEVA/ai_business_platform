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
exports.MessagesController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const current_user_decorator_1 = require("../../common/auth/current-user.decorator");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const roles_guard_1 = require("../../common/auth/roles.guard");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const create_message_dto_1 = require("./dto/create-message.dto");
const messages_service_1 = require("./messages.service");
class ConversationParam {
    conversationId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ConversationParam.prototype, "conversationId", void 0);
class ListQuery {
    limit;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ListQuery.prototype, "limit", void 0);
let MessagesController = class MessagesController {
    messagesService;
    constructor(messagesService) {
        this.messagesService = messagesService;
    }
    list(user, params, query) {
        const limit = query.limit ? Number(query.limit) : 50;
        return this.messagesService.list(user.companyId, params.conversationId, limit);
    }
    create(user, params, dto) {
        return this.messagesService.createFromUser(user.companyId, params.conversationId, dto);
    }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator', 'viewer'),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ConversationParam,
        ListQuery]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)('admin', 'operator'),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ConversationParam,
        create_message_dto_1.CreateMessageDto]),
    __metadata("design:returntype", void 0)
], MessagesController.prototype, "create", null);
exports.MessagesController = MessagesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('conversations/:conversationId/messages'),
    __metadata("design:paramtypes", [messages_service_1.MessagesService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map