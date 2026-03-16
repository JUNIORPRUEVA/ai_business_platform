import { Repository } from 'typeorm';
import { ConversationEntity } from '../conversations/entities/conversation.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageEntity, MessageSender, MessageType } from './entities/message.entity';
export declare class MessagesService {
    private readonly messagesRepository;
    private readonly conversationsRepository;
    constructor(messagesRepository: Repository<MessageEntity>, conversationsRepository: Repository<ConversationEntity>);
    list(companyId: string, conversationId: string, limit?: number): Promise<MessageEntity[]>;
    createFromUser(companyId: string, conversationId: string, dto: CreateMessageDto): Promise<MessageEntity>;
    create(companyId: string, conversationId: string, params: {
        sender: MessageSender;
        content: string;
        type: MessageType;
    }): Promise<MessageEntity>;
}
