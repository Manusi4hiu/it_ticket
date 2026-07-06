/**
 * Shared Ticket Types
 *
 * Single source of truth for all Ticket-related interfaces.
 * Import from here instead of defining inline types per service/component.
 */

export interface TicketNote {
    id: string;
    ticketId?: string;
    content: string;
    author: string;
    authorId?: number;
    imageUrl?: string;
    createdAt: string;
    isInternal: boolean;
}

export interface Ticket {
    id: string;
    ticketCode?: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    submitterName: string;
    submitterEmail: string;
    submitterPhone?: string;
    submitterDepartment?: string;
    imageUrl?: string;
    assignedTo?: string;
    assignedToId?: number;
    collaborators: string[];
    collaboratorIds?: number[];
    slaDeadline?: string;
    slaStatus: string;
    resolutionSummary?: string;
    resolvedAt?: string;
    createdAt: string;
    updatedAt: string;
    notes?: TicketNote[];
}

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
