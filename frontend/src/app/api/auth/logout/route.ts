import { NextResponse } from "next/server";
import { TOKEN_COOKIE } from "../_constants";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { headers: { "x-request-id": "local-logout" } });
  res.cookies.set({
    name: TOKEN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
