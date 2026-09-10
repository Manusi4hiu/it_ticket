/**
 * ticket-ui.ts
 *
 * Utility functions untuk UI logic yang berkaitan dengan ticket —
 * warna status, class priority, icon status, dll.
 * Terpusat agar tidak duplikat di dashboard, ticket detail, dan lainnya.
 */

import type { Status } from "~/services/settings.service";

// ─────────────────────────────────────────────
// Status Color
// ─────────────────────────────────────────────

/**
 * Ambil warna hex/var dari status berdasarkan list Status dari API.
 * Fallback ke warna neutral jika status tidak ditemukan.
 *
 * @param statusName - Nama status (case-insensitive)
 * @param statuses - Array Status dari settingsApi.getStatuses()
 * @returns CSS color string, contoh: "#10b981" atau "var(--color-neutral-8)"
 */
export function getStatusColor(statusName: string, statuses: Status[]): string {
  const found = statuses.find(
    (s) => s.name.toLowerCase() === statusName.toLowerCase()
  );
  return found?.color || "var(--color-neutral-8)";
}

// ─────────────────────────────────────────────
// CSS Class Helpers
// ─────────────────────────────────────────────

/**
 * Return CSS Module class name untuk priority badge.
 *
 * @param priority - Nama priority (case-insensitive)
 * @param styles - CSS Modules styles object dari route/component
 * @returns Class name string atau string kosong jika tidak cocok
 */
export function getPriorityClass(
  priority: string,
  styles: Record<string, string>
): string {
  const p = priority.toLowerCase();
  switch (p) {
    case "critical":
      return styles.priorityCritical ?? "";
    case "high":
      return styles.priorityHigh ?? "";
    case "medium":
      return styles.priorityMedium ?? "";
    case "low":
      return styles.priorityLow ?? "";
    default:
      return "";
  }
}

/**
 * Return CSS Module class name untuk status badge.
 *
 * @param status - Nama status (case-insensitive)
 * @param styles - CSS Modules styles object dari route/component
 * @returns Class name string atau string kosong jika tidak cocok
 */
export function getStatusClass(
  status: string,
  styles: Record<string, string>
): string {
  const s = status.toLowerCase();
  if (["new", "triaged", "assigned"].includes(s)) return styles.statusNew ?? "";
  if (["in progress", "in-progress"].includes(s)) return styles.statusInprogress ?? "";
  if (["resolved", "closed"].includes(s)) return styles.statusResolved ?? "";
  return "";
}

// ─────────────────────────────────────────────
// Formatters & Status Sorting
// ─────────────────────────────────────────────

export function getStatusWorkflowRank(statusOrName: string | { name: string; isDefault?: boolean }): number {
  const name = typeof statusOrName === 'string' ? statusOrName : statusOrName?.name || '';
  const isDef = typeof statusOrName === 'object' ? Boolean(statusOrName?.isDefault) : false;
  const lower = String(name || '').toLowerCase().trim();

  // 1. Initial/Default status always comes first
  if (isDef || lower === 'new') return 1;

  // 2. Lifecycle order: match backend ORDER BY
  // New(1) → Triaged(2) → Assigned(3) → In Progress(4) → Pending(5) → Resolved(6) → Closed(7)
  if (lower.includes('triage')) return 2;
  if (lower.includes('assign')) return 3;
  if (lower.includes('progress') || lower.includes('work') || lower.includes('dev')) return 4;
  if (lower.includes('pending') || lower.includes('hold') || lower.includes('wait')) return 5;
  if (lower.includes('resolve') || lower === 'completed') return 6;
  if (lower.includes('done') || lower.includes('closed')) return 7;
  return 10;
}

export function sortStatusesByWorkflow<T extends { name: string; isDefault?: boolean }>(statuses: T[]): T[] {
  return [...statuses].sort((a, b) => {
    const ra = getStatusWorkflowRank(a);
    const rb = getStatusWorkflowRank(b);
    if (ra !== rb) return ra - rb;
    return String(a.name).localeCompare(String(b.name));
  });
}

/**
 * Infer grup tombol segmented filter Tickets dari nama status.
 * Dipakai sebagai fallback ketika `filterGroup` eksplisit (Settings) belum diset
 * atau status dihapus — menjamin 3 tombol New/Progress/Done tetap berfungsi.
 *
 * @param name - Nama status
 * @param isDefault - Apakah status default (tiket baru)
 * @returns 'new' | 'progress' | 'done' | 'pending'
 */
export function inferFilterGroup(name: string, isDefault?: boolean): "new" | "progress" | "done" | "pending" {
  const lower = String(name || "").toLowerCase().trim();
  if (isDefault || lower === "new") return "new";
  if (lower.includes("pending") || lower.includes("hold") || lower.includes("wait")) return "pending";
  if (
    lower.includes("resolve") ||
    lower.includes("done") ||
    lower.includes("closed") ||
    lower === "completed"
  ) return "done";
  return "progress";
}

/**
 * Capitalize huruf pertama status name.
 *
 * @param statusName - Nama status raw
 * @returns Contoh: "in progress" → "In progress"
 */
export function formatStatus(statusName: string): string {
  return statusName.charAt(0).toUpperCase() + statusName.slice(1);
}

/**
 * Cek apakah status termasuk "resolved/completed".
 *
 * @param status - Nama status
 * @returns true jika ticket sudah selesai
 */
export function isResolvedStatus(status: string): boolean {
  return ["resolved", "completed"].includes(status.toLowerCase());
}

/**
 * Cek apakah ticket masih bisa di-take/di-assign.
 * Ticket dengan status selesai (resolved/closed/completed) TIDAK bisa di-take —
 * harus diubah statusnya dulu dari resolved ke status lain (aturan bisnis).
 *
 * @param status - Nama status ticket
 * @returns true jika take/assign masih diizinkan
 */
export function canTakeTicket(status: string): boolean {
  const s = String(status || "").toLowerCase().trim();
  return !["resolved", "closed", "completed"].includes(s);
}
