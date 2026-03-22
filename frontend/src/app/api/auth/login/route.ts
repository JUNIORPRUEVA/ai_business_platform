import { NextResponse } from "next/server";
import { routeErrorResponse } from "../../_errors";
import { backendJson } from "../_backend";
import { TOKEN_COOKIE, TOKEN_MAX_AGE_SECONDS } from "../_constants";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; companyId?: string }
    | null;

  if (!body?.email || !body?.password) {
    return routeErrorResponse({
      status: 400,
      message: "email y password son requeridos",
      module: "auth_login_route",
      path: "/api/auth/login",
      method: "POST",
      type: "validation",
    });
  }

  const result = await backendJson<{ accessToken: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      ...(body.companyId ? { companyId: body.companyId } : {}),
    }),
  });

  if (!result.ok) {
    return routeErrorResponse({
      status: result.status,
      message: result.message,
      details: result.details,
      module: result.module ?? "auth_login_route",
      path: "/api/auth/login",
      method: "POST",
      requestId: result.requestId,
      type: result.type,
    });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: TOKEN_COOKIE,
    value: result.data.accessToken,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE_SECONDS,
  });
  return res;
}
