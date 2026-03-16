import { Repository } from 'typeorm';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptEntity } from './entities/prompt.entity';
export declare class PromptsService {
    private readonly promptsRepository;
    constructor(promptsRepository: Repository<PromptEntity>);
    list(companyId: string): Promise<PromptEntity[]>;
    get(companyId: string, id: string): Promise<PromptEntity>;
    create(companyId: string, dto: CreatePromptDto): Promise<PromptEntity>;
    update(companyId: string, id: string, dto: UpdatePromptDto): Promise<PromptEntity>;
    remove(companyId: string, id: string): Promise<{
        readonly deleted: true;
    }>;
    getActiveSystemPrompt(companyId: string): Promise<string | null>;
}
