/**
 * types.ts
 *
 * Local type definitions untuk route ticket.$id.
 * Memisahkan interface dari komponen agar lebih mudah didokumentasikan.
 */

import type { Ticket } from "~/services/ticket.service";
import type { Agent } from "~/services/ticket.service";
import type { Priority, Category, Status } from "~/services/settings.service";

// ─────────────────────────────────────────────
// Session Types
// ─────────────────────────────────────────────

/** Info sesi user yang sedang login (subset dari session cookie). */
export interface CurrentUser {
  id: string;
  name: string;
  role: string;
}

// ─────────────────────────────────────────────
// Staff Info (mengganti `any` di StaffProfileModal)
// ─────────────────────────────────────────────

/** Data staff yang ditampilkan di modal profile. */
export interface StaffInfo {
  id: string;
  name: string;
  email: string;
  phone?: string;
  username?: string;
}

// ─────────────────────────────────────────────
// View Mode
// ─────────────────────────────────────────────

/**
 * Enum view mode untuk ticket detail:
 * - public: akses tanpa login (tracking saja)
 * - management: view-only, tidak bisa ubah status
 * - staff: full access sesuai assignment
 * - administrator: full access + unlock priority/assign
 */
export type TicketViewMode = "public" | "management" | "staff" | "administrator";

// ─────────────────────────────────────────────
// Shared Props
// ─────────────────────────────────────────────

/** Props umum yang dibagi ke semua sub-komponen ticket detail. */
export interface TicketDetailSharedProps {
  ticket: Ticket;
  statuses: Status[];
  agents: Agent[];
  priorities: Priority[];
  categories: Category[];
  currentUser: CurrentUser | null;
  viewMode: TicketViewMode;
}
