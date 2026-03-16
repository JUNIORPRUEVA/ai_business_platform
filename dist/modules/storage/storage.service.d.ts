import { ConfigService } from '@nestjs/config';
import { StorageFolder } from './dto/presign-upload.dto';
export declare class StorageService {
    private readonly configService;
    private readonly s3;
    constructor(configService: ConfigService);
    getBucket(): string;
    buildObjectKey(companyId: string, folder: StorageFolder, filename: string): string;
    presignUpload(params: {
        companyId: string;
        folder: StorageFolder;
        filename: string;
        contentType?: string;
        expiresInSeconds?: number;
    }): Promise<{
        key: string;
        url: string;
        expiresInSeconds: number;
    }>;
    presignDownload(params: {
        companyId: string;
        key: string;
        expiresInSeconds?: number;
    }): Promise<{
        key: string;
        url: string;
        expiresInSeconds: number;
    }>;
}
