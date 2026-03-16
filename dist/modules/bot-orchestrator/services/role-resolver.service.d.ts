import { ProcessIncomingMessageDto } from '../dto/process-incoming-message.dto';
import { RoleResolutionResult } from '../types/bot-orchestrator.types';
export declare class RoleResolverService {
    resolve(payload: ProcessIncomingMessageDto): RoleResolutionResult;
    private readMetadataRole;
}
