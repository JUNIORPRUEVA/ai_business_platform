import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { BotMemoryService } from '../../bot-memory/services/bot-memory.service';
import { OpenAiService } from '../../openai/services/openai.service';
import { ProcessIncomingMessageDto } from '../dto/process-incoming-message.dto';
import { BotResponsePlan } from '../types/bot-orchestrator.types';
import { IntentClassifierService } from './intent-classifier.service';
import { MemoryLoaderService } from './memory-loader.service';
import { RoleResolverService } from './role-resolver.service';
import { ToolDecisionService } from './tool-decision.service';
export declare class BotOrchestratorService {
    private readonly botConfigurationService;
    private readonly botMemoryService;
    private readonly openAiService;
    private readonly roleResolverService;
    private readonly memoryLoaderService;
    private readonly intentClassifierService;
    private readonly toolDecisionService;
    constructor(botConfigurationService: BotConfigurationService, botMemoryService: BotMemoryService, openAiService: OpenAiService, roleResolverService: RoleResolverService, memoryLoaderService: MemoryLoaderService, intentClassifierService: IntentClassifierService, toolDecisionService: ToolDecisionService);
    processIncomingMessage(payload: ProcessIncomingMessageDto): Promise<BotResponsePlan>;
    private mapRuntimeConfiguration;
    private buildResponseDraft;
    private appendLog;
}
