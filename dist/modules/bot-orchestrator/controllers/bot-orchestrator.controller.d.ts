import { ProcessIncomingMessageDto } from '../dto/process-incoming-message.dto';
import { BotResponsePlan } from '../types/bot-orchestrator.types';
import { BotOrchestratorService } from '../services/bot-orchestrator.service';
export declare class BotOrchestratorController {
    private readonly botOrchestratorService;
    constructor(botOrchestratorService: BotOrchestratorService);
    processIncomingMessage(payload: ProcessIncomingMessageDto): Promise<BotResponsePlan>;
}
