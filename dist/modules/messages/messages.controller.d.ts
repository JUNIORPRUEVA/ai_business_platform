import { AuthUser } from '../../common/auth/auth.types';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesService } from './messages.service';
declare class ConversationParam {
    conversationId: string;
}
declare class ListQuery {
    limit?: string;
}
export declare class MessagesController {
    private readonly messagesService;
    constructor(messagesService: MessagesService);
    list(user: AuthUser, params: ConversationParam, query: ListQuery): Promise<import("./entities/message.entity").MessageEntity[]>;
    create(user: AuthUser, params: ConversationParam, dto: CreateMessageDto): Promise<import("./entities/message.entity").MessageEntity>;
}
export {};
