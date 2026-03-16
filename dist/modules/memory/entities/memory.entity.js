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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryEntity = void 0;
const typeorm_1 = require("typeorm");
const base_entity_1 = require("../../../common/entities/base.entity");
let MemoryEntity = class MemoryEntity extends base_entity_1.BaseEntity {
    companyId;
    contactId;
    type;
    content;
};
exports.MemoryEntity = MemoryEntity;
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'company_id' }),
    __metadata("design:type", String)
], MemoryEntity.prototype, "companyId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', name: 'contact_id' }),
    __metadata("design:type", String)
], MemoryEntity.prototype, "contactId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], MemoryEntity.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], MemoryEntity.prototype, "content", void 0);
exports.MemoryEntity = MemoryEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'memory' }),
    (0, typeorm_1.Index)(['companyId']),
    (0, typeorm_1.Index)(['companyId', 'contactId'])
], MemoryEntity);
//# sourceMappingURL=memory.entity.js.map