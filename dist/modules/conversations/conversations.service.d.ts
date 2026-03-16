import { Repository } from 'typeorm';
import { ChannelEntity } from '../channels/entities/channel.entity';
import { ContactEntity } from '../contacts/entities/contact.entity';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationEntity } from './entities/conversation.entity';
export declare class ConversationsService {
    private readonly conversationsRepository;
    private readonly channelsRepository;
    private readonly contactsRepository;
    constructor(conversationsRepository: Repository<ConversationEntity>, channelsRepository: Repository<ChannelEntity>, contactsRepository: Repository<ContactEntity>);
    list(companyId: string): Promise<ConversationEntity[]>;
    get(companyId: string, id: string): Promise<ConversationEntity>;
    create(companyId: string, dto: CreateConversationDto): Promise<ConversationEntity>;
    update(companyId: string, id: string, dto: UpdateConversationDto): Promise<ConversationEntity>;
    remove(companyId: string, id: string): Promise<{
        readonly deleted: true;
    }>;
    findOrCreateOpen(companyId: string, channelId: string, contactId: string): Promise<ConversationEntity>;
}
