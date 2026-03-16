import { AuthUser } from '../../common/auth/auth.types';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptsService } from './prompts.service';
declare class IdParam {
    id: string;
}
export declare class PromptsController {
    private readonly promptsService;
    constructor(promptsService: PromptsService);
    list(user: AuthUser): Promise<import("./entities/prompt.entity").PromptEntity[]>;
    get(user: AuthUser, params: IdParam): Promise<import("./entities/prompt.entity").PromptEntity>;
    create(user: AuthUser, dto: CreatePromptDto): Promise<import("./entities/prompt.entity").PromptEntity>;
    update(user: AuthUser, params: IdParam, dto: UpdatePromptDto): Promise<import("./entities/prompt.entity").PromptEntity>;
    remove(user: AuthUser, params: IdParam): Promise<{
        readonly deleted: true;
    }>;
}
export {};
