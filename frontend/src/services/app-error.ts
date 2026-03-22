export type AppErrorType =
  | "validation"
  | "authentication"
  | "authorization"
  | "not_found"
  | "conflict"
  | "rate_limit"
  | "external_service"
  | "network"
  | "ui"
  | "internal"
  | "unknown";

export type AppErrorSource = "frontend" | "backend";

export type AppErrorData = {
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
  source: AppErrorSource;
  stack?: string;
};

export type AppErrorEnvelope = {
  error: Omit<AppErrorData, "source"> & { source?: AppErrorSource };
};

export type AppErrorLogFeed = {
  items: AppErrorData[];
  total: number;
};

type CreateAppErrorInput = Partial<AppErrorData> & {
  message: string;
};

export class AppRequestError extends Error implements AppErrorData {
  id: string;
  type: AppErrorType;
  details: string[];
  module: string;
  timestamp: string;
  statusCode: number;
  path: string;
  method: string;
  requestId: string;
  source: AppErrorSource;
  stack?: string;

  constructor(input: CreateAppErrorInput) {
    super(input.message);
    this.name = "AppRequestError";
    this.id = input.id ?? buildErrorId();
    this.type = input.type ?? "unknown";
    this.details = input.details ?? [];
    this.module = input.module ?? "application";
    this.timestamp = input.timestamp ?? new Date().toISOString();
    this.statusCode = input.statusCode ?? 500;
    this.path = input.path ?? "unknown";
    this.method = input.method ?? "UNKNOWN";
    this.requestId = input.requestId ?? this.id;
    this.source = input.source ?? "frontend";
    this.stack = input.stack;
  }
}

export function buildErrorId(): string {
  return `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isAppErrorEnvelope(value: unknown): value is AppErrorEnvelope {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeError = (value as { error?: unknown }).error;
  return Boolean(maybeError && typeof maybeError === "object" && "message" in maybeError);
}

export function isAppRequestError(value: unknown): value is AppRequestError {
  return value instanceof AppRequestError;
}

export function toAppRequestError(
  value: unknown,
  fallback: Partial<AppErrorData> = {},
): AppRequestError {
  if (value instanceof AppRequestError) {
    return value;
  }

  if (isAppErrorEnvelope(value)) {
    return new AppRequestError({
      ...fallback,
      ...value.error,
      source: value.error.source ?? fallback.source ?? "backend",
      message: value.error.message,
      details: Array.isArray(value.error.details) ? value.error.details : [],
    });
  }

  if (value instanceof Error) {
    return new AppRequestError({
      ...fallback,
      message: value.message || fallback.message || "Unexpected application error",
      stack: value.stack,
      type: fallback.type ?? "unknown",
    });
  }

  if (typeof value === "string" && value.trim()) {
    return new AppRequestError({
      ...fallback,
      message: value,
    });
  }

  if (value && typeof value === "object") {
    const payload = value as {
      message?: unknown;
      error?: unknown;
      details?: unknown;
      type?: unknown;
      statusCode?: unknown;
      requestId?: unknown;
      module?: unknown;
    };

    return new AppRequestError({
      ...fallback,
      message:
        (typeof payload.message === "string" && payload.message) ||
        (typeof payload.error === "string" && payload.error) ||
        fallback.message ||
        "Unexpected application error",
      details: Array.isArray(payload.details)
        ? payload.details.filter((item): item is string => typeof item === "string")
        : fallback.details,
      type: isAppErrorType(payload.type) ? payload.type : fallback.type,
      statusCode: typeof payload.statusCode === "number" ? payload.statusCode : fallback.statusCode,
      requestId: typeof payload.requestId === "string" ? payload.requestId : fallback.requestId,
      module: typeof payload.module === "string" ? payload.module : fallback.module,
    });
  }

  return new AppRequestError({
    ...fallback,
    message: fallback.message ?? "Unexpected application error",
  });
}

export async function parseResponseError(
  res: Response,
  fallback: Partial<AppErrorData> = {},
): Promise<AppRequestError> {
  const text = await res.text().catch(() => "");
  const baseFallback: Partial<AppErrorData> = {
    ...fallback,
    statusCode: res.status,
    requestId: res.headers.get("x-request-id") ?? fallback.requestId,
    source: fallback.source ?? "backend",
  };

  if (!text) {
    return new AppRequestError({
      ...baseFallback,
      message: res.statusText || "Request failed",
      type: fallback.type ?? mapStatusToType(res.status),
    });
  }

  try {
    return toAppRequestError(JSON.parse(text), {
      ...baseFallback,
      message: res.statusText || "Request failed",
      type: fallback.type ?? mapStatusToType(res.status),
    });
  } catch {
    return toAppRequestError(text, {
      ...baseFallback,
      message: res.statusText || text || "Request failed",
      type: fallback.type ?? mapStatusToType(res.status),
    });
  }
}

export async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  let res: Response;

  try {
    res = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: init?.cache ?? "no-store",
    });
  } catch (error) {
    throw toAppRequestError(error, {
      type: "network",
      source: "frontend",
      module: "http",
      path: typeof input === "string" ? input : "unknown",
      method: init?.method ?? "GET",
      message: "No se pudo conectar con el servidor",
      statusCode: 0,
    });
  }

  if (!res.ok) {
    throw await parseResponseError(res, {
      type: mapStatusToType(res.status),
      source: "backend",
      module: "http",
      path: typeof input === "string" ? input : "unknown",
      method: init?.method ?? "GET",
    });
  }

  return (await res.json()) as T;
}

export function serializeAppError(error: AppErrorData): string {
  return JSON.stringify(error, null, 2);
}

export function mapStatusToType(statusCode: number): AppErrorType {
  switch (statusCode) {
    case 0:
      return "network";
    case 400:
    case 422:
      return "validation";
    case 401:
      return "authentication";
    case 403:
      return "authorization";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limit";
    case 502:
    case 503:
    case 504:
      return "external_service";
    default:
      return statusCode >= 500 ? "internal" : "unknown";
  }
}

function isAppErrorType(value: unknown): value is AppErrorType {
  return typeof value === "string" && [
    "validation",
    "authentication",
    "authorization",
    "not_found",
    "conflict",
    "rate_limit",
    "external_service",
    "network",
    "ui",
    "internal",
    "unknown",
  ].includes(value);
}