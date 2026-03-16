import { Repository } from 'typeorm';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactEntity } from './entities/contact.entity';
export declare class ContactsService {
    private readonly contactsRepository;
    constructor(contactsRepository: Repository<ContactEntity>);
    list(companyId: string): Promise<ContactEntity[]>;
    get(companyId: string, id: string): Promise<ContactEntity>;
    create(companyId: string, dto: CreateContactDto): Promise<ContactEntity>;
    update(companyId: string, id: string, dto: UpdateContactDto): Promise<ContactEntity>;
    remove(companyId: string, id: string): Promise<{
        readonly deleted: true;
    }>;
    findOrCreateByPhone(companyId: string, phone: string, name?: string | null): Promise<ContactEntity>;
}
