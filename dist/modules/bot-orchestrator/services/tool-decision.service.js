"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolDecisionService = void 0;
const common_1 = require("@nestjs/common");
let ToolDecisionService = class ToolDecisionService {
    decide(params) {
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
        const matchingTool = configuration.enabledTools.find((tool) => tool.active && tool.intents.includes(detectedIntent));
        if (configuration.allowToolExecution && matchingTool) {
            return {
                selectedAction: 'use_tool',
                selectedTool: matchingTool.id,
                promptStrategy: 'tool-assisted-ai',
                needsHumanEscalation: matchingTool.requiresConfirmation &&
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
                rationale: 'No direct rule or tool was sufficient, so a grounded AI response should be prepared.',
            };
        }
        return {
            selectedAction: 'escalate',
            promptStrategy: 'safe-escalation',
            needsHumanEscalation: true,
            rationale: 'Fallback policy requires escalation when no automated path is available.',
        };
    }
};
exports.ToolDecisionService = ToolDecisionService;
exports.ToolDecisionService = ToolDecisionService = __decorate([
    (0, common_1.Injectable)()
], ToolDecisionService);
//# sourceMappingURL=tool-decision.service.js.map