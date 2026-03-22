export type AppErrorType =
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'rate_limit'
  | 'external_service'
  | 'internal'
  | 'unknown';

export interface AppErrorPayload {
  id: string;
  type: AppErrorType;
  message: string;
  details: string[];
  module: string;
  timestamp: string;
  statusCode: number;
  path: string;
  method: string;
  requestId: string;
}

export interface AppErrorResponse {
  error: AppErrorPayload;
}

export interface AppErrorLogEntry extends AppErrorPayload {
  source: 'backend';
  stack?: string;
}

export interface AppErrorLogQuery {
  limit?: number;
  debug?: boolean;
}