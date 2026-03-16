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
exports.JsonFileStoreService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
let JsonFileStoreService = class JsonFileStoreService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    async readOrCreate(relativeFilePath, fallbackFactory) {
        const absolutePath = this.resolveStoragePath(relativeFilePath);
        try {
            const raw = await (0, promises_1.readFile)(absolutePath, 'utf8');
            return JSON.parse(raw);
        }
        catch {
            const fallback = fallbackFactory();
            await this.write(relativeFilePath, fallback);
            return fallback;
        }
    }
    async write(relativeFilePath, value) {
        const absolutePath = this.resolveStoragePath(relativeFilePath);
        await (0, promises_1.mkdir)((0, node_path_1.dirname)(absolutePath), { recursive: true });
        await (0, promises_1.writeFile)(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    }
    resolveStoragePath(relativeFilePath) {
        const storageDir = this.configService.get('BACKEND_STORAGE_DIR') ?? 'data';
        return (0, node_path_1.resolve)((0, node_path_1.join)(process.cwd(), storageDir, relativeFilePath));
    }
};
exports.JsonFileStoreService = JsonFileStoreService;
exports.JsonFileStoreService = JsonFileStoreService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], JsonFileStoreService);
//# sourceMappingURL=json-file-store.service.js.map