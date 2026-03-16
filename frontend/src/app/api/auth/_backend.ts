import { getBackendUrl } from "@/services/env";

export function backendUrl(path: string): string {
  const base = getBackendUrl();
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function backendJson<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const url = backendUrl(path);
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (res.ok) {
    return { ok: true, data: (await res.json()) as T };
  }

  const text = await res.text().catch(() => "");
  let message = text || res.statusText;
  try {
    const parsed = JSON.parse(text);
    message = parsed?.message ?? parsed?.error ?? message;
  } catch {
    // ignore
  }

  return { ok: false, status: res.status, message };
}
