/** Returns Vite's configured base URL guaranteed to end with a trailing slash. */
export function getBaseUrl(): string {
  return (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
}

/** Resolves a path inside `public/` against the configured Vite base URL. */
export function publicAsset(path: string): string {
  return `${getBaseUrl()}${path.replace(/^\/+/, "")}`;
}

/**
 * Resolves a backend-served upload path (e.g. `/static/uploads/...`).
 * Uses `VITE_BACKEND_URL` when explicitly set, otherwise stays same-origin
 * so LAN mobile devices and reverse proxies resolve without `localhost:5000`.
 */
export function backendAsset(path?: string | null): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const configured = ((import.meta.env.VITE_BACKEND_URL as string | undefined) || "").trim().replace(/\/$/, "");
  return configured ? `${configured}${normalized}` : normalized;
}
