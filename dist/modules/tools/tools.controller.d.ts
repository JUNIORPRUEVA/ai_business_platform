import { AuthUser } from '../../common/auth/auth.types';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { ToolsService } from './tools.service';
declare class IdParam {
    id: string;
}
export declare class ToolsController {
    private readonly toolsService;
    constructor(toolsService: ToolsService);
    list(user: AuthUser): Promise<import("./entities/tool.entity").ToolEntity[]>;
    get(user: AuthUser, params: IdParam): Promise<import("./entities/tool.entity").ToolEntity>;
    create(user: AuthUser, dto: CreateToolDto): Promise<import("./entities/tool.entity").ToolEntity>;
    update(user: AuthUser, params: IdParam, dto: UpdateToolDto): Promise<import("./entities/tool.entity").ToolEntity>;
    remove(user: AuthUser, params: IdParam): Promise<{
        readonly deleted: true;
    }>;
}
export {};
