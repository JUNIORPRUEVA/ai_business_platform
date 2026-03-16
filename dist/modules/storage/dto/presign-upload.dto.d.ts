export type StorageFolder = 'bots' | 'contacts' | 'documents' | 'media';
export declare class PresignUploadDto {
    folder: StorageFolder;
    filename: string;
    contentType?: string;
}
