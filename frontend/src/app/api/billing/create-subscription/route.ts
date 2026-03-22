import { NextResponse } from "next/server";
import { routeErrorResponse } from "../../_errors";
import { backendJson } from "../../auth/_backend";
import { getAuthToken } from "../_auth";

export async function POST() {
  const token = await getAuthToken();
  if (!token) {
    return routeErrorResponse({
      status: 401,
      message: "Not authenticated",
      module: "billing_create_subscription_route",
      path: "/api/billing/create-subscription",
      method: "POST",
      type: "authentication",
    });
  }

  const result = await backendJson<{ approvalUrl: string; paypalSubscriptionId: string }>(
    "/billing/create-subscription",
    { method: "POST", token },
  );

  if (!result.ok) {
    return routeErrorResponse({
      status: result.status,
      message: result.message,
      details: result.details,
      module: result.module ?? "billing_create_subscription_route",
      path: "/api/billing/create-subscription",
      method: "POST",
      requestId: result.requestId,
      type: result.type,
    });
  }

  return NextResponse.json(result.data);
}
