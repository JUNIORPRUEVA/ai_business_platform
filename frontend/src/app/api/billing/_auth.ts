import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "../auth/_constants";

export async function getAuthToken(): Promise<string> {
  return (await cookies()).get(TOKEN_COOKIE)?.value ?? "";
}
