import { Repository } from 'typeorm';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';
import { AutomationEntity } from './entities/automation.entity';
export declare class AutomationsService {
    private readonly automationsRepository;
    constructor(automationsRepository: Repository<AutomationEntity>);
    list(companyId: string): Promise<AutomationEntity[]>;
    get(companyId: string, id: string): Promise<AutomationEntity>;
    create(companyId: string, dto: CreateAutomationDto): Promise<AutomationEntity>;
    update(companyId: string, id: string, dto: UpdateAutomationDto): Promise<AutomationEntity>;
    remove(companyId: string, id: string): Promise<{
        readonly deleted: true;
    }>;
}
