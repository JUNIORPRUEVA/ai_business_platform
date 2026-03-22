import { mapStatusToType, parseResponseError } from "@/services/app-error";
import { getBackendUrl } from "@/services/env";

export function backendUrl(path: string): string {
  const base = getBackendUrl();
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function backendJson<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<
  | { ok: true; data: T; requestId?: string }
  | {
      ok: false;
      status: number;
      message: string;
      details: string[];
      type: ReturnType<typeof mapStatusToType>;
      requestId?: string;
      module?: string;
    }
> {
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
    return {
      ok: true,
      data: (await res.json()) as T,
      requestId: res.headers.get("x-request-id") ?? undefined,
    };
  }

  const error = await parseResponseError(res, {
    source: "backend",
    module: "backend_proxy",
    path,
    method: init.method ?? "GET",
    type: mapStatusToType(res.status),
  });

  return {
    ok: false,
    status: res.status,
    message: error.message,
    details: error.details,
    type: error.type,
    requestId: error.requestId,
    module: error.module,
  };
}
