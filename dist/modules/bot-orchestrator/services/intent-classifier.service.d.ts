import { ProcessIncomingMessageDto } from '../dto/process-incoming-message.dto';
import { BotDetectedRole, IntentClassificationResult } from '../types/bot-orchestrator.types';
export declare class IntentClassifierService {
    classify(payload: ProcessIncomingMessageDto, detectedRole: BotDetectedRole): IntentClassificationResult;
}
