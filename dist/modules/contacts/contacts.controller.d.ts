import { AuthUser } from '../../common/auth/auth.types';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactsService } from './contacts.service';
declare class IdParam {
    id: string;
}
export declare class ContactsController {
    private readonly contactsService;
    constructor(contactsService: ContactsService);
    list(user: AuthUser): Promise<import("./entities/contact.entity").ContactEntity[]>;
    get(user: AuthUser, params: IdParam): Promise<import("./entities/contact.entity").ContactEntity>;
    create(user: AuthUser, dto: CreateContactDto): Promise<import("./entities/contact.entity").ContactEntity>;
    update(user: AuthUser, params: IdParam, dto: UpdateContactDto): Promise<import("./entities/contact.entity").ContactEntity>;
    remove(user: AuthUser, params: IdParam): Promise<{
        readonly deleted: true;
    }>;
}
export {};
