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
// Formatters
// ─────────────────────────────────────────────

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
 * Cek apakah status termasuk "resolved/closed/completed".
 *
 * @param status - Nama status
 * @returns true jika ticket sudah selesai
 */
export function isResolvedStatus(status: string): boolean {
  return ["resolved", "closed", "completed"].includes(status.toLowerCase());
}
