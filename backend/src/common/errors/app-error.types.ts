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

export interface AppErrorResponse {
  error: {
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
  };
}

export interface AppErrorLogEntry extends AppErrorResponse['error'] {
  source: 'backend';
  stack?: string;
}

export interface AppErrorLogQuery {
  limit?: number;
  debug?: boolean;
}