import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { routeErrorResponse } from "../../_errors";
import { backendJson } from "../_backend";
import { TOKEN_COOKIE } from "../_constants";

type AuthUser = {
  userId: string;
  companyId: string;
  role: "admin" | "operator" | "viewer";
  email: string;
  name: string;
};

type Company = {
  id: string;
  name: string;
  plan: string;
  status: string;
};

export async function GET(req: Request) {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value ?? "";

  if (!token) {
    return routeErrorResponse({
      status: 401,
      message: "Not authenticated",
      module: "auth_session_route",
      path: "/api/auth/session",
      method: "GET",
      type: "authentication",
    });
  }

  const [me, company] = await Promise.all([
    backendJson<AuthUser>("/auth/me", { token }),
    backendJson<Company>("/companies/me", { token }),
  ]);

  if (!me.ok) {
    return routeErrorResponse({
      status: me.status,
      message: me.message,
      details: me.details,
      module: me.module ?? "auth_session_route",
      path: "/api/auth/session",
      method: "GET",
      requestId: me.requestId,
      type: me.type,
    });
  }
  if (!company.ok) {
    return routeErrorResponse({
      status: company.status,
      message: company.message,
      details: company.details,
      module: company.module ?? "auth_session_route",
      path: "/api/auth/session",
      method: "GET",
      requestId: company.requestId,
      type: company.type,
    });
  }

  return NextResponse.json({ user: me.data, company: company.data });
}
