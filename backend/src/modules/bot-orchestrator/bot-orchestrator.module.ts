import { Module } from '@nestjs/common';

import { BotConfigurationModule } from '../bot-configuration/bot-configuration.module';
import { OpenAiModule } from '../openai/openai.module';
import { BotOrchestratorController } from './controllers/bot-orchestrator.controller';
import { BotOrchestratorService } from './services/bot-orchestrator.service';
import { IntentClassifierService } from './services/intent-classifier.service';
import { MemoryLoaderService } from './services/memory-loader.service';
import { RoleResolverService } from './services/role-resolver.service';
import { ToolDecisionService } from './services/tool-decision.service';

@Module({
  imports: [BotConfigurationModule, OpenAiModule],
  controllers: [BotOrchestratorController],
  providers: [
    BotOrchestratorService,
    IntentClassifierService,
    RoleResolverService,
    MemoryLoaderService,
    ToolDecisionService,
  ],
  exports: [BotOrchestratorService],
})
export class BotOrchestratorModule {}