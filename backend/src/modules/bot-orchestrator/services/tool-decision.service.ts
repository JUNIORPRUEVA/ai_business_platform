import { Injectable } from '@nestjs/common';

import {
  BotDetectedIntent,
  BotRuntimeConfiguration,
  LoadedMemoryBundle,
  ToolDecisionResult,
} from '../types/bot-orchestrator.types';

@Injectable()
export class ToolDecisionService {
  decide(params: {
    detectedIntent: BotDetectedIntent;
    configuration: BotRuntimeConfiguration;
    memory: LoadedMemoryBundle;
  }): ToolDecisionResult {
    const { configuration, detectedIntent } = params;

    if (detectedIntent === 'human_handoff') {
      return {
        selectedAction: 'escalate',
        promptStrategy: 'safe-escalation',
        needsHumanEscalation: true,
        rationale: 'Explicit human handoff request must bypass automated handling.',
      };
    }

    if (detectedIntent === 'configuration_request') {
      return {
        selectedAction: 'escalate',
        promptStrategy: 'safe-escalation',
        needsHumanEscalation: true,
        rationale: 'Configuration changes require authenticated administrative flows.',
      };
    }

    if (!configuration.active) {
      return {
        selectedAction: 'escalate',
        promptStrategy: 'safe-escalation',
        needsHumanEscalation: true,
        rationale: 'Runtime is inactive, so the message cannot be processed autonomously.',
      };
    }

    const matchingTool = configuration.enabledTools.find(
      (tool) => tool.active && tool.intents.includes(detectedIntent),
    );

    if (configuration.allowToolExecution && matchingTool) {
      return {
        selectedAction: 'use_tool',
        selectedTool: matchingTool.id,
        promptStrategy: 'tool-assisted-ai',
        needsHumanEscalation:
          matchingTool.requiresConfirmation &&
          configuration.autonomyLevel === 'strict',
        rationale: `A mapped tool is available for ${detectedIntent} and should be prepared before response generation.`,
      };
    }

    if (detectedIntent === 'greeting' && configuration.allowDirectResponses) {
      return {
        selectedAction: 'answer_directly',
        promptStrategy: 'direct-template',
        needsHumanEscalation: false,
        rationale: 'Greeting can be answered safely with a direct template.',
      };
    }

    if (configuration.allowAiResponses) {
      return {
        selectedAction: 'use_ai',
        promptStrategy: 'knowledge-grounded-ai',
        needsHumanEscalation: false,
        rationale:
          'No direct rule or tool was sufficient, so a grounded AI response should be prepared.',
      };
    }

    return {
      selectedAction: 'escalate',
      promptStrategy: 'safe-escalation',
      needsHumanEscalation: true,
      rationale: 'Fallback policy requires escalation when no automated path is available.',
    };
  }
}