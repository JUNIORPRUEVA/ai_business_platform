import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

import { AppErrorLogService } from './app-error-log.service';
import { AppErrorResponse, AppErrorType } from './app-error.types';

type RequestLike = {
  method?: string;
  url?: string;
  originalUrl?: string;
  requestId?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(payload: unknown): void;
  setHeader(name: string, value: string): void;
};

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly appErrorLogService: AppErrorLogService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const response = http.getResponse<ResponseLike>();

    const statusCode = this.resolveStatusCode(exception);
    const requestId = this.resolveRequestId(request);
    const payload = this.buildResponse(exception, {
      statusCode,
      requestId,
      path: request.originalUrl ?? request.url ?? 'unknown',
      method: request.method ?? 'UNKNOWN',
    });

    this.appErrorLogService.add({
      ...payload.error,
      source: 'backend',
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    this.logger.error(
      `${payload.error.method} ${payload.error.path} -> ${payload.error.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.setHeader('x-request-id', requestId);
    response.status(statusCode).json(payload);
  }

  private buildResponse(
    exception: unknown,
    context: {
      statusCode: number;
      requestId: string;
      path: string;
      method: string;
    },
  ): AppErrorResponse {
    const timestamp = new Date().toISOString();
    const normalized = this.normalizeException(exception, context.statusCode);

    return {
      error: {
        id: this.buildErrorId(),
        type: normalized.type,
        message: normalized.message,
        details: normalized.details,
        module: normalized.module,
        timestamp,
        statusCode: context.statusCode,
        path: context.path,
        method: context.method,
        requestId: context.requestId,
      },
    };
  }

  private normalizeException(
    exception: unknown,
    statusCode: number,
  ): { type: AppErrorType; message: string; details: string[]; module: string } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const details = this.extractDetails(response);
      const message = this.extractMessage(response, exception.message);

      return {
        type: this.mapStatusToType(statusCode),
        message,
        details,
        module: this.extractModule(exception),
      };
    }

    if (exception instanceof Error) {
      return {
        type: 'internal',
        message: exception.message || 'Internal server error',
        details: [],
        module: this.extractModule(exception),
      };
    }

    return {
      type: 'unknown',
      message: 'Unexpected server error',
      details: [],
      module: 'unknown',
    };
  }

  private extractDetails(response: string | object): string[] {
    if (typeof response === 'string') {
      return [];
    }

    const details = (response as { message?: unknown }).message;
    if (Array.isArray(details)) {
      return details.filter((item): item is string => typeof item === 'string');
    }

    return [];
  }

  private extractMessage(response: string | object, fallback: string): string {
    if (typeof response === 'string') {
      return response;
    }

    const payload = response as { message?: unknown; error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
    if (Array.isArray(payload.message) && payload.message.length > 0) {
      const first = payload.message.find((item): item is string => typeof item === 'string');
      if (first) {
        return first;
      }
    }

    return fallback || 'Request failed';
  }

  private extractModule(exception: Error): string {
    const name = exception.name || 'Error';
    return name.replace(/Exception$|Error$/g, '').toLowerCase() || 'application';
  }

  private mapStatusToType(statusCode: number): AppErrorType {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'validation';
      case HttpStatus.UNAUTHORIZED:
        return 'authentication';
      case HttpStatus.FORBIDDEN:
        return 'authorization';
      case HttpStatus.NOT_FOUND:
        return 'not_found';
      case HttpStatus.CONFLICT:
        return 'conflict';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'rate_limit';
      case HttpStatus.BAD_GATEWAY:
      case HttpStatus.SERVICE_UNAVAILABLE:
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'external_service';
      default:
        return statusCode >= 500 ? 'internal' : 'unknown';
    }
  }

  private resolveStatusCode(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveRequestId(request: RequestLike): string {
    const fromRequest = request.requestId;
    if (fromRequest) {
      return fromRequest;
    }

    const fromHeader = request.headers?.['x-request-id'];
    if (typeof fromHeader === 'string' && fromHeader.trim()) {
      request.requestId = fromHeader;
      return fromHeader;
    }

    const generated = this.buildErrorId();
    request.requestId = generated;
    return generated;
  }

  private buildErrorId(): string {
    return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}