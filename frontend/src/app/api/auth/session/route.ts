import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const [me, company] = await Promise.all([
    backendJson<AuthUser>("/auth/me", { token }),
    backendJson<Company>("/companies/me", { token }),
  ]);

  if (!me.ok) {
    return NextResponse.json({ message: me.message }, { status: me.status });
  }
  if (!company.ok) {
    return NextResponse.json({ message: company.message }, { status: company.status });
  }

  return NextResponse.json({ user: me.data, company: company.data });
}
