import { AuthUser } from '../../common/auth/auth.types';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { MemoryService } from './memory.service';
declare class IdParam {
    id: string;
}
export declare class MemoryController {
    private readonly memoryService;
    constructor(memoryService: MemoryService);
    list(user: AuthUser): Promise<import("./entities/memory.entity").MemoryEntity[]>;
    get(user: AuthUser, params: IdParam): Promise<import("./entities/memory.entity").MemoryEntity>;
    create(user: AuthUser, dto: CreateMemoryDto): Promise<import("./entities/memory.entity").MemoryEntity>;
    update(user: AuthUser, params: IdParam, dto: UpdateMemoryDto): Promise<import("./entities/memory.entity").MemoryEntity>;
    remove(user: AuthUser, params: IdParam): Promise<{
        readonly deleted: true;
    }>;
}
export {};
