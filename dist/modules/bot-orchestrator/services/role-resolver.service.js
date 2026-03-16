"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleResolverService = void 0;
const common_1 = require("@nestjs/common");
let RoleResolverService = class RoleResolverService {
    resolve(payload) {
        const metadataRole = this.readMetadataRole(payload.metadata);
        if (metadataRole) {
            return {
                detectedRole: metadataRole,
                confidence: 0.96,
                source: 'metadata',
            };
        }
        const senderName = payload.senderName?.toLowerCase() ?? '';
        const message = payload.message.toLowerCase();
        if (/(owner|proprietario|proprietário)/.test(senderName)) {
            return { detectedRole: 'owner', confidence: 0.88, source: 'senderName' };
        }
        if (/(manager|gerente|director|diretor|operations)/.test(senderName)) {
            return { detectedRole: 'manager', confidence: 0.84, source: 'senderName' };
        }
        if (/(finance|billing|financeiro)/.test(senderName + ' ' + message)) {
            return { detectedRole: 'finance', confidence: 0.8, source: 'message' };
        }
        if (/(operator|atendente|support agent)/.test(senderName + ' ' + message)) {
            return { detectedRole: 'operator', confidence: 0.78, source: 'message' };
        }
        if (/(cashier|caixa|pdv)/.test(senderName + ' ' + message)) {
            return { detectedRole: 'cashier', confidence: 0.76, source: 'message' };
        }
        if (payload.channel.toLowerCase() === 'whatsapp') {
            return { detectedRole: 'lead', confidence: 0.58, source: 'default' };
        }
        return { detectedRole: 'unknown', confidence: 0.32, source: 'default' };
    }
    readMetadataRole(metadata) {
        const rawValue = metadata?.['role'];
        if (typeof rawValue !== 'string') {
            return null;
        }
        const value = rawValue.toLowerCase();
        if (value === 'unknown' ||
            value === 'lead' ||
            value === 'customer' ||
            value === 'owner' ||
            value === 'manager' ||
            value === 'operator' ||
            value === 'cashier' ||
            value === 'finance') {
            return value;
        }
        return null;
    }
};
exports.RoleResolverService = RoleResolverService;
exports.RoleResolverService = RoleResolverService = __decorate([
    (0, common_1.Injectable)()
], RoleResolverService);
//# sourceMappingURL=role-resolver.service.js.map