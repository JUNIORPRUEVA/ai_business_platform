import { NextResponse } from "next/server";
import { backendJson } from "../_backend";
import { TOKEN_COOKIE, TOKEN_MAX_AGE_SECONDS } from "../_constants";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | { email?: string; password?: string; companyId?: string }
    | null;

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { message: "email y password son requeridos" },
      { status: 400 },
    );
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
    return NextResponse.json({ message: result.message }, { status: result.status });
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
