/**
 * team-cookie.ts
 *
 * Utility untuk sinkronisasi dan persistensi active team workspace (IT vs Graphic Design)
 * antar page, baik di level client (localStorage & document.cookie) maupun
 * di level server loader (Request Cookie header).
 */

export const ACTIVE_TEAM_COOKIE_NAME = "app_active_team_id";

/**
 * Membaca active team ID dari Request headers (Cookie) atau URL query parameter di server loader.
 * Prioritas:
 * 1. URL search parameter `?teamId=...`
 * 2. Cookie `app_active_team_id=...`
 */
export function getActiveTeamIdFromRequest(request: Request, url?: URL): string | null {
  const currentUrl = url || new URL(request.url);
  const param = currentUrl.searchParams.get("teamId");
  if (param && param.trim()) {
    return param.trim();
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)app_active_team_id=([^;]+)/);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1].trim());
      if (decoded && decoded !== "undefined" && decoded !== "null") {
        return decoded;
      }
    } catch {
      const raw = match[1].trim();
      if (raw && raw !== "undefined" && raw !== "null") {
        return raw;
      }
    }
  }
  return null;
}

/**
 * Menyimpan active team ID ke localStorage dan document.cookie di browser.
 * Berlaku di semua path ('/') selama 1 tahun (max-age=31536000).
 */
export function setActiveTeamId(teamId: string | number | null | undefined): void {
  if (typeof window === "undefined") return;

  if (!teamId || teamId === "all") {
    localStorage.removeItem(ACTIVE_TEAM_COOKIE_NAME);
    document.cookie = `${ACTIVE_TEAM_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    return;
  }

  const idStr = String(teamId).trim();
  localStorage.setItem(ACTIVE_TEAM_COOKIE_NAME, idStr);
  document.cookie = `${ACTIVE_TEAM_COOKIE_NAME}=${encodeURIComponent(idStr)}; path=/; max-age=31536000; SameSite=Lax`;
}

/**
 * Membaca active team ID yang tersimpan di browser (client-side).
 */
export function getActiveTeamIdClient(): string | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(ACTIVE_TEAM_COOKIE_NAME);
  if (stored && stored !== "undefined" && stored !== "null") {
    return stored;
  }

  const match = document.cookie.match(/(?:^|;\s*)app_active_team_id=([^;]+)/);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1].trim());
      if (decoded && decoded !== "undefined" && decoded !== "null") {
        return decoded;
      }
    } catch {
      const raw = match[1].trim();
      if (raw && raw !== "undefined" && raw !== "null") {
        return raw;
      }
    }
  }
  return null;
}
