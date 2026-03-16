export declare class UpdateMemorySettingsDto {
    enableShortTermMemory?: boolean;
    enableLongTermMemory?: boolean;
    enableOperationalMemory?: boolean;
    recentMessageWindowSize?: number;
    automaticSummarization?: boolean;
    memoryTtl?: string;
    useRedis?: boolean;
    usePostgreSql?: boolean;
}
