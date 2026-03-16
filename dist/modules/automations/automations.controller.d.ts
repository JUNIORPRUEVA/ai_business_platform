import { AuthUser } from '../../common/auth/auth.types';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { AutomationsService } from './automations.service';
declare class IdParam {
    id: string;
}
export declare class AutomationsController {
    private readonly automationsService;
    constructor(automationsService: AutomationsService);
    list(user: AuthUser): Promise<import("./entities/automation.entity").AutomationEntity[]>;
    get(user: AuthUser, params: IdParam): Promise<import("./entities/automation.entity").AutomationEntity>;
    create(user: AuthUser, dto: CreateAutomationDto): Promise<import("./entities/automation.entity").AutomationEntity>;
    update(user: AuthUser, params: IdParam, dto: UpdateAutomationDto): Promise<import("./entities/automation.entity").AutomationEntity>;
    remove(user: AuthUser, params: IdParam): Promise<{
        readonly deleted: true;
    }>;
}
export {};
