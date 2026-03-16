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
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const node_crypto_1 = require("node:crypto");
let StorageService = class StorageService {
    configService;
    s3;
    constructor(configService) {
        this.configService = configService;
        const region = this.configService.get('S3_REGION') ?? 'auto';
        const endpoint = this.configService.get('S3_ENDPOINT');
        const accessKeyId = this.configService.get('S3_ACCESS_KEY_ID') ?? '';
        const secretAccessKey = this.configService.get('S3_SECRET_ACCESS_KEY') ?? '';
        this.s3 = new client_s3_1.S3Client({
            region,
            endpoint,
            forcePathStyle: (this.configService.get('S3_FORCE_PATH_STYLE') ?? 'false') === 'true',
            credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
        });
    }
    getBucket() {
        const bucket = this.configService.get('S3_BUCKET') ?? '';
        if (!bucket) {
            throw new common_1.BadRequestException('S3_BUCKET is not configured.');
        }
        return bucket;
    }
    buildObjectKey(companyId, folder, filename) {
        const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        return `${companyId}/${folder}/${(0, node_crypto_1.randomUUID)()}-${safeFilename}`;
    }
    async presignUpload(params) {
        const key = this.buildObjectKey(params.companyId, params.folder, params.filename);
        const bucket = this.getBucket();
        const expiresInSeconds = params.expiresInSeconds ?? 900;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: params.contentType,
        });
        const url = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn: expiresInSeconds });
        return { key, url, expiresInSeconds };
    }
    async presignDownload(params) {
        if (!params.key.startsWith(`${params.companyId}/`)) {
            throw new common_1.BadRequestException('Key does not belong to this company.');
        }
        const bucket = this.getBucket();
        const expiresInSeconds = params.expiresInSeconds ?? 900;
        const command = new client_s3_1.GetObjectCommand({
            Bucket: bucket,
            Key: params.key,
        });
        const url = await (0, s3_request_presigner_1.getSignedUrl)(this.s3, command, { expiresIn: expiresInSeconds });
        return { key: params.key, url, expiresInSeconds };
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], StorageService);
//# sourceMappingURL=storage.service.js.map