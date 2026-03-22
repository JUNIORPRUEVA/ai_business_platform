import { NextResponse } from "next/server";

import { routeErrorResponse } from "../../_errors";
import { getAuthToken } from "../../_auth";
import { backendJson } from "../../auth/_backend";

export async function GET(req: Request) {
  const token = await getAuthToken();
  const url = new URL(req.url);
  const limit = url.searchParams.get("limit") ?? "50";
  const debug = url.searchParams.get("debug") ?? "0";

  if (!token) {
    return routeErrorResponse({
      status: 401,
      message: "Not authenticated",
      module: "system_errors_route",
      path: "/api/system/errors",
      method: "GET",
      type: "authentication",
    });
  }

  const result = await backendJson(`/system/errors?limit=${encodeURIComponent(limit)}&debug=${encodeURIComponent(debug)}`, {
    token,
  });

  if (!result.ok) {
    return routeErrorResponse({
      status: result.status,
      message: result.message,
      details: result.details,
      module: result.module ?? "system_errors_route",
      path: "/api/system/errors",
      method: "GET",
      requestId: result.requestId,
      type: result.type,
    });
  }

  return NextResponse.json(result.data, {
    headers: result.requestId ? { "x-request-id": result.requestId } : undefined,
  });
}