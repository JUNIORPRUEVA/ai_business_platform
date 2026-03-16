export type BotDetectedRole =
  | 'unknown'
  | 'lead'
  | 'customer'
  | 'owner'
  | 'manager'
  | 'operator'
  | 'cashier'
  | 'finance';

export type BotDetectedIntent =
  | 'greeting'
  | 'product_question'
  | 'catalog_search'
  | 'pricing_inquiry'
  | 'billing_question'
  | 'order_status'
  | 'support_request'
  | 'configuration_request'
  | 'human_handoff'
  | 'unknown';

export type BotSelectedAction =
  | 'answer_directly'
  | 'use_ai'
  | 'use_tool'
  | 'escalate';

export type BotPromptStrategy =
  | 'direct-template'
  | 'knowledge-grounded-ai'
  | 'tool-assisted-ai'
  | 'safe-escalation';

export type BotMemoryScope = 'shortTerm' | 'longTerm' | 'operational';

export interface BotToolDefinition {
  id: string;
  name: string;
  description: string;
  intents: BotDetectedIntent[];
  requiresConfirmation: boolean;
  active: boolean;
}

export interface BotRuntimeConfiguration {
  active: boolean;
  defaultLanguage: string;
  allowDirectResponses: boolean;
  allowAiResponses: boolean;
  allowToolExecution: boolean;
  allowAutoEscalation: boolean;
  autonomyLevel: 'strict' | 'guarded' | 'balanced';
  fallbackStrategy: string;
  preferredPromptStrategy: BotPromptStrategy;
  enabledTools: BotToolDefinition[];
}

export interface RoleResolutionResult {
  detectedRole: BotDetectedRole;
  confidence: number;
  source: 'metadata' | 'senderName' | 'message' | 'default';
}

export interface IntentClassificationResult {
  intent: BotDetectedIntent;
  confidence: number;
  rationale: string;
}

export interface LoadedMemoryItem {
  id: string;
  scope: BotMemoryScope;
  title: string;
  content: string;
  relevanceScore: number;
}

export interface LoadedMemoryBundle {
  shortTerm: LoadedMemoryItem[];
  longTerm: LoadedMemoryItem[];
  operational: LoadedMemoryItem[];
  combined: LoadedMemoryItem[];
}

export interface ToolDecisionResult {
  selectedAction: BotSelectedAction;
  selectedTool?: string;
  promptStrategy: BotPromptStrategy;
  needsHumanEscalation: boolean;
  rationale: string;
}

export interface BotOrchestratorLog {
  timestamp: string;
  stage: string;
  summary: string;
  details?: string;
}

export interface BotResponsePlan {
  detectedRole: BotDetectedRole;
  detectedIntent: BotDetectedIntent;
  memoryUsed: LoadedMemoryItem[];
  selectedAction: BotSelectedAction;
  selectedTool?: string;
  promptStrategy: BotPromptStrategy;
  responseDraft: string;
  needsHumanEscalation: boolean;
  logs: BotOrchestratorLog[];
}