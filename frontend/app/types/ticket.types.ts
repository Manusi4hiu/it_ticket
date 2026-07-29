/**
 * Shared Ticket Types — SINGLE SOURCE OF TRUTH
 *
 * SEMUA komponen dan service import dari sini, bukan inline define.
 */

// ─────────────────────────────────────────────
// Enums / Literal Unions
// ─────────────────────────────────────────────

export type SLAStatus = "good" | "warning" | "breached";
export type TicketStatus = string;
export type TicketPriority = string;
export type TicketCategory = string;

// ─────────────────────────────────────────────
// Note
// ─────────────────────────────────────────────

export interface TicketNote {
    id: number;
    content: string;
    author: string;
    createdAt: Date;
    isInternal: boolean;
    imageUrl?: string;
}

// ─────────────────────────────────────────────
// Ticket
// ─────────────────────────────────────────────

export interface Ticket {
    id: number;
    ticketCode?: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
    submitterName: string;
    submitterEmail: string;
    submitterPhone?: string;
    submitterDepartment?: string;
    imageUrl?: string;
    assignedTo?: string;
    assignedToId?: number;
    collaborators: string[];
    collaboratorIds: number[];
    slaDeadline?: Date;
    slaPausedAt?: Date;
    slaStatus: SLAStatus;
    resolutionSummary?: string;
    resolutionImageUrl?: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    notes: TicketNote[];
}

// ─────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────

export interface TicketSLA {
    breached: number;
    warning: number;
    healthy: number;
}

export interface TicketTrend {
    day: string;
    created: number;
    resolved: number;
}

export interface TicketStats {
    total: number;
    new: number;
    assigned: number;
    resolved: number;
    workedOn: number;
    sla: TicketSLA;
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    byDepartment: Record<string, number>;
    trend: TicketTrend[];
    avgResolutionTime: number;
}

// ─────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────

export interface CreateTicketPayload {
    title: string;
    description: string;
    category: string;
    priority?: string;
    submitterName: string;
    submitterEmail: string;
    submitterPhone?: string;
    submitterDepartment?: string;
}
