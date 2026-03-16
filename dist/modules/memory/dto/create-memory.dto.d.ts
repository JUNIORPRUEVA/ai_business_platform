import { MemoryType } from '../entities/memory.entity';
export declare class CreateMemoryDto {
    contactId: string;
    type: MemoryType;
    content: string;
}
