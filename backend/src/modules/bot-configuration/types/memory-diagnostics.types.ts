import { MemorySettings } from './bot-configuration.types';

export type MemoryDiagnosticState = 'healthy' | 'degraded' | 'offline';

export interface MemoryInfrastructureStatus {
  state: MemoryDiagnosticState;
  configured: boolean;
  active: boolean;
  label: string;
  detail: string;
}

export interface MemoryDiagnosticsResponse {
  generatedAt: string;
  overallState: MemoryDiagnosticState;
  overallSummary: string;
  persistence: {
    postgres: MemoryInfrastructureStatus;
    redis: MemoryInfrastructureStatus;
  };
  features: {
    shortTerm: boolean;
    longTerm: boolean;
    operational: boolean;
    summaries: boolean;
    deduplication: boolean;
    pruning: boolean;
    debug: boolean;
  };
  configuration: Pick<
    MemorySettings,
    | 'recentMessageWindowSize'
    | 'summaryRefreshThreshold'
    | 'memoryTtl'
    | 'useRedis'
    | 'usePostgreSql'
    | 'automaticSummarization'
  >;
  counters: {
    contacts: number;
    conversations: number;
    conversationMemoryActive: number;
    conversationMemoryCompacted: number;
    clientFacts: number;
    operationalMemory: number;
    summaries: number;
  };
  activity: {
    lastConversationMemoryAt: string | null;
    lastSummaryAt: string | null;
  };
  notes: string[];
}