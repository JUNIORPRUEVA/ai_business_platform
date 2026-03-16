import { ConfigService } from '@nestjs/config';
export declare class JsonFileStoreService {
    private readonly configService;
    constructor(configService: ConfigService);
    readOrCreate<T>(relativeFilePath: string, fallbackFactory: () => T): Promise<T>;
    write<T>(relativeFilePath: string, value: T): Promise<void>;
    resolveStoragePath(relativeFilePath: string): string;
}
