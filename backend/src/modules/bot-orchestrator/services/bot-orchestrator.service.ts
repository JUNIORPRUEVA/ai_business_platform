import { Injectable } from '@nestjs/common';

import { BotConfigurationService } from '../../bot-configuration/services/bot-configuration.service';
import { BotMemoryService } from '../../bot-memory/services/bot-memory.service';
import { OpenAiService } from '../../openai/services/openai.service';
import { BotConfigurationBundle } from '../../bot-configuration/types/bot-configuration.types';
import { ProcessIncomingMessageDto } from '../dto/process-incoming-message.dto';
import {
  BotOrchestratorLog,
  BotResponsePlan,
  BotRuntimeConfiguration,
  LoadedMemoryBundle,
} from '../types/bot-orchestrator.types';
import { IntentClassifierService } from './intent-classifier.service';
import { MemoryLoaderService } from './memory-loader.service';
import { RoleResolverService } from './role-resolver.service';
import { ToolDecisionService } from './tool-decision.service';

@Injectable()
export class BotOrchestratorService {
  constructor(
    private readonly botConfigurationService: BotConfigurationService,
    private readonly botMemoryService: BotMemoryService,
    private readonly openAiService: OpenAiService,
    private readonly roleResolverService: RoleResolverService,
    private readonly memoryLoaderService: MemoryLoaderService,
    private readonly intentClassifierService: IntentClassifierService,
    private readonly toolDecisionService: ToolDecisionService,
  ) {}

  async processIncomingMessage(
    payload: ProcessIncomingMessageDto,
  ): Promise<BotResponsePlan> {
    const logs: BotOrchestratorLog[] = [];
    const timestamp = payload.timestamp ?? new Date().toISOString();
    const senderLabel = payload.senderName?.trim() || payload.senderId;
    const conversationId = payload.senderId;

    this.appendLog(logs, 'ingress', 'Incoming message accepted.', `${payload.channel}:${senderLabel}`);

    const configurationBundle = this.botConfigurationService.getConfiguration();
    const configuration = this.mapRuntimeConfiguration(configurationBundle, payload.channel);
    this.appendLog(
      logs,
      'configuration',
      'Active configuration loaded.',
      `Autonomy=${configuration.autonomyLevel}; tools=${configuration.enabledTools.filter((tool) => tool.active).length}`,
      timestamp,
    );

    const role = this.roleResolverService.resolve(payload);
    this.appendLog(
      logs,
      'role-resolution',
      `Role detected as ${role.detectedRole}.`,
      `source=${role.source}; confidence=${role.confidence.toFixed(2)}`,
      timestamp,
    );

    const intent = this.intentClassifierService.classify(
      payload,
      role.detectedRole,
    );
    this.appendLog(
      logs,
      'intent-classification',
      `Intent classified as ${intent.intent}.`,
      `confidence=${intent.confidence.toFixed(2)}; rationale=${intent.rationale}`,
      timestamp,
    );

    const memory = this.memoryLoaderService.loadAll({
      conversationId,
      senderId: payload.senderId,
      detectedIntent: intent.intent,
      detectedRole: role.detectedRole,
      configuration,
    });
    this.appendLog(
      logs,
      'memory-loading',
      'Memory layers loaded.',
      `short=${memory.shortTerm.length}; long=${memory.longTerm.length}; operational=${memory.operational.length}`,
      timestamp,
    );

    const decision = this.toolDecisionService.decide({
      detectedIntent: intent.intent,
      configuration,
      memory,
    });
    this.appendLog(
      logs,
      'decision',
      `Selected action is ${decision.selectedAction}.`,
      `tool=${decision.selectedTool ?? 'none'}; escalation=${decision.needsHumanEscalation}`,
      timestamp,
    );

    const responseDraft = await this.buildResponseDraft({
      payload,
      configuration,
      configurationBundle,
      memoryContext: memory,
      detectedRole: role.detectedRole,
      detectedIntent: intent.intent,
      selectedAction: decision.selectedAction,
      selectedTool: decision.selectedTool,
      needsHumanEscalation: decision.needsHumanEscalation,
    });
    this.appendLog(
      logs,
      'response-planning',
      'Response plan prepared.',
      `strategy=${decision.promptStrategy}`,
      timestamp,
    );

    await this.botMemoryService.saveOperationalState({
      conversationId,
      stage: decision.selectedAction,
      lastIntent: intent.intent,
      assignedTool: decision.selectedTool,
      needsHumanEscalation: decision.needsHumanEscalation,
    });

    if (memory.shortTerm.length >= 2 && configurationBundle.memory.automaticSummarization) {
      await this.botMemoryService.saveConversationSummary({
        conversationId,
        generatedFromMessages: memory.shortTerm.length,
        summary: `Latest intent=${intent.intent}; recent context=${memory.shortTerm
          .slice(0, 3)
          .map((item) => item.content)
          .join(' | ')}`,
      });
    }

    return {
      detectedRole: role.detectedRole,
      detectedIntent: intent.intent,
      memoryUsed: memory.combined,
      selectedAction: decision.selectedAction,
      selectedTool: decision.selectedTool,
      promptStrategy: decision.promptStrategy,
      responseDraft,
      needsHumanEscalation: decision.needsHumanEscalation,
      logs,
    };
  }

  private mapRuntimeConfiguration(
    configurationBundle: BotConfigurationBundle,
    channel: string,
  ): BotRuntimeConfiguration {
    return {
      active: configurationBundle.general.isEnabled,
      defaultLanguage: configurationBundle.general.defaultLanguage,
      allowDirectResponses: configurationBundle.orchestrator.automaticMode,
      allowAiResponses: configurationBundle.openai.isEnabled,
      allowToolExecution: configurationBundle.orchestrator.enableToolExecution,
      allowAutoEscalation: configurationBundle.orchestrator.assistedMode,
      autonomyLevel: configurationBundle.orchestrator.autonomyLevel,
      fallbackStrategy: configurationBundle.orchestrator.fallbackStrategy,
      preferredPromptStrategy: 'knowledge-grounded-ai',
      enabledTools: configurationBundle.tools.map((tool) => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        intents: tool.intents as BotRuntimeConfiguration['enabledTools'][number]['intents'],
        requiresConfirmation: tool.requiresConfirmation,
        active: tool.isEnabled && channel.toLowerCase() !== 'instagram',
      })),
    };
  }

  private async buildResponseDraft(params: {
    payload: ProcessIncomingMessageDto;
    configuration: BotRuntimeConfiguration;
    configurationBundle: BotConfigurationBundle;
    memoryContext: LoadedMemoryBundle;
    detectedRole: BotResponsePlan['detectedRole'];
    detectedIntent: BotResponsePlan['detectedIntent'];
    selectedAction: BotResponsePlan['selectedAction'];
    selectedTool?: string;
    needsHumanEscalation: boolean;
  }): Promise<string> {
    const senderName = params.payload.senderName?.trim() || 'customer';

    switch (params.selectedAction) {
      case 'answer_directly':
        return `Acknowledge ${senderName} and continue in ${params.configuration.defaultLanguage} with a short greeting plus a clarifying question.`;
      case 'use_tool':
        return `Prepare ${params.selectedTool} with sender=${params.payload.senderId}, intent=${params.detectedIntent}, then generate a grounded reply for ${senderName} using the returned business data.`;
      case 'use_ai': {
        const draft = await this.openAiService.draftResponse({
          senderName,
          message: params.payload.message,
          detectedIntent: params.detectedIntent,
          systemPrompt:
            params.configurationBundle.prompts[0]?.content ||
            params.configurationBundle.openai.systemPromptPreview,
          memoryContext: params.memoryContext.combined
            .map((item) => `${item.title}: ${item.content}`)
            .join('\n'),
        });
        return draft.content;
      }
      case 'escalate':
        return params.needsHumanEscalation
          ? `Acknowledge ${senderName}, explain that a human specialist will continue the case, and attach a concise internal handoff summary.`
          : `Keep the response minimal and request human review before continuing.`;
    }
  }

  private appendLog(
    logs: BotOrchestratorLog[],
    stage: string,
    summary: string,
    details?: string,
    timestamp = new Date().toISOString(),
  ): void {
    logs.push({
      timestamp,
      stage,
      summary,
      details,
    });
  }
}