import { Repository } from 'typeorm';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolEntity } from './entities/tool.entity';
export declare class ToolsService {
    private readonly toolsRepository;
    constructor(toolsRepository: Repository<ToolEntity>);
    list(companyId: string): Promise<ToolEntity[]>;
    get(companyId: string, id: string): Promise<ToolEntity>;
    create(companyId: string, dto: CreateToolDto): Promise<ToolEntity>;
    update(companyId: string, id: string, dto: UpdateToolDto): Promise<ToolEntity>;
    remove(companyId: string, id: string): Promise<{
        readonly deleted: true;
    }>;
}
