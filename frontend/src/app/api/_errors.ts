import { NextResponse } from "next/server";

import {
  AppErrorData,
  AppErrorType,
  buildErrorId,
  mapStatusToType,
} from "@/services/app-error";

type RouteErrorInput = {
  status: number;
  message: string;
  details?: string[];
  module: string;
  path: string;
  method: string;
  requestId?: string;
  type?: AppErrorType;
};

export function routeErrorResponse(input: RouteErrorInput) {
  const requestId = input.requestId ?? buildErrorId();
  const payload = {
    error: {
      id: buildErrorId(),
      type: input.type ?? mapStatusToType(input.status),
      message: input.message,
      details: input.details ?? [],
      module: input.module,
      timestamp: new Date().toISOString(),
      statusCode: input.status,
      path: input.path,
      method: input.method,
      requestId,
      source: "backend",
    },
  } satisfies { error: AppErrorData };

  return NextResponse.json(payload, {
    status: input.status,
    headers: {
      "x-request-id": requestId,
    },
  });
}