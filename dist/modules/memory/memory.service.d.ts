import { Repository } from 'typeorm';
import { ContactEntity } from '../contacts/entities/contact.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { MemoryEntity } from './entities/memory.entity';
export declare class MemoryService {
    private readonly memoryRepository;
    private readonly contactsRepository;
    constructor(memoryRepository: Repository<MemoryEntity>, contactsRepository: Repository<ContactEntity>);
    list(companyId: string): Promise<MemoryEntity[]>;
    get(companyId: string, id: string): Promise<MemoryEntity>;
    create(companyId: string, dto: CreateMemoryDto): Promise<MemoryEntity>;
    update(companyId: string, id: string, dto: UpdateMemoryDto): Promise<MemoryEntity>;
    remove(companyId: string, id: string): Promise<{
        readonly deleted: true;
    }>;
    listForContact(companyId: string, contactId: string): Promise<MemoryEntity[]>;
}
