export function getBackendUrl(): string {
  // Server-side: use BACKEND_URL. Client-side: only NEXT_PUBLIC_API_URL is available.
  const url =
    process.env.BACKEND_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:3001";

  return url.replace(/\/$/, "");
}
