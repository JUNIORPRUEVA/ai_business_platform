import { AuthUser } from '../../common/auth/auth.types';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationsService } from './conversations.service';
declare class IdParam {
    id: string;
}
export declare class ConversationsController {
    private readonly conversationsService;
    constructor(conversationsService: ConversationsService);
    list(user: AuthUser): Promise<import("./entities/conversation.entity").ConversationEntity[]>;
    get(user: AuthUser, params: IdParam): Promise<import("./entities/conversation.entity").ConversationEntity>;
    create(user: AuthUser, dto: CreateConversationDto): Promise<import("./entities/conversation.entity").ConversationEntity>;
    update(user: AuthUser, params: IdParam, dto: UpdateConversationDto): Promise<import("./entities/conversation.entity").ConversationEntity>;
    remove(user: AuthUser, params: IdParam): Promise<{
        readonly deleted: true;
    }>;
}
export {};
