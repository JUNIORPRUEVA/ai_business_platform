import { NextResponse, type NextRequest } from "next/server";
import { TOKEN_COOKIE } from "./app/api/auth/_constants";

const PUBLIC_PATHS = new Set(["/welcome", "/login", "/register"]);
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/billing",
  "/bots",
  "/channels",
  "/contacts",
  "/conversations",
  "/automations",
  "/settings",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(TOKEN_COOKIE)?.value;
  const isPublic = PUBLIC_PATHS.has(pathname);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!token && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }

  if (token && isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/welcome",
    "/login",
    "/register",
    "/dashboard/:path*",
    "/billing/:path*",
    "/bots/:path*",
    "/channels/:path*",
    "/contacts/:path*",
    "/conversations/:path*",
    "/automations/:path*",
    "/settings/:path*",
  ],
};
