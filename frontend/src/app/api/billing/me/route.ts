import { NextResponse } from "next/server";
import { routeErrorResponse } from "../../_errors";
import { backendJson } from "../../auth/_backend";
import { getAuthToken } from "../_auth";

export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return routeErrorResponse({
      status: 401,
      message: "Not authenticated",
      module: "billing_me_route",
      path: "/api/billing/me",
      method: "GET",
      type: "authentication",
    });
  }

  const result = await backendJson("/billing/me", { token });
  if (!result.ok) {
    return routeErrorResponse({
      status: result.status,
      message: result.message,
      details: result.details,
      module: result.module ?? "billing_me_route",
      path: "/api/billing/me",
      method: "GET",
      requestId: result.requestId,
      type: result.type,
    });
  }

  return NextResponse.json(result.data);
}
