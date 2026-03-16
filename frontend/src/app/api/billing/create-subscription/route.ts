import { NextResponse } from "next/server";
import { backendJson } from "../../auth/_backend";
import { getAuthToken } from "../_auth";

export async function POST() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const result = await backendJson<{ approvalUrl: string; paypalSubscriptionId: string }>(
    "/billing/create-subscription",
    { method: "POST", token },
  );

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
