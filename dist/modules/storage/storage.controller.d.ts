import { AuthUser } from '../../common/auth/auth.types';
import { PresignUploadDto } from './dto/presign-upload.dto';
import { StorageService } from './storage.service';
declare class PresignDownloadQuery {
    key: string;
}
export declare class StorageController {
    private readonly storageService;
    constructor(storageService: StorageService);
    presignUpload(user: AuthUser, dto: PresignUploadDto): Promise<{
        key: string;
        url: string;
        expiresInSeconds: number;
    }>;
    presignDownload(user: AuthUser, query: PresignDownloadQuery): Promise<{
        key: string;
        url: string;
        expiresInSeconds: number;
    }>;
}
export {};
