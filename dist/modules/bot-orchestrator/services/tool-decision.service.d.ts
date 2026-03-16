import { BotDetectedIntent, BotRuntimeConfiguration, LoadedMemoryBundle, ToolDecisionResult } from '../types/bot-orchestrator.types';
export declare class ToolDecisionService {
    decide(params: {
        detectedIntent: BotDetectedIntent;
        configuration: BotRuntimeConfiguration;
        memory: LoadedMemoryBundle;
    }): ToolDecisionResult;
}
