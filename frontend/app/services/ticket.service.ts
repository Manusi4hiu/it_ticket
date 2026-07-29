/**
 * Ticket Service - Using backend API
 *
 * Domain service — converts raw API responses (snake_case, strings) into
 * app-level types (camelCase, Date objects).
 *
 * Types are imported from ~/types/*, NOT defined here.
 */

import { ticketsApi, usersApi } from './api.service';
import type { Ticket, TicketNote, SLAStatus } from '~/types/ticket.types';
import type { Agent } from '~/types/user.types';

// ── Backward-compat re-exports (routes import these from service) ──
export type { Ticket, TicketNote, Agent, SLAStatus };

// ─────────────────────────────────────────────
// Mapper: raw API record → domain Ticket
// ─────────────────────────────────────────────

function mapApiTicket(apiTicket: Record<string, unknown>): Ticket {
    return {
        id: apiTicket.id as number,
        ticketCode: apiTicket.ticketCode as string | undefined,
        title: apiTicket.title as string,
        description: apiTicket.description as string,
        status: apiTicket.status as string,
        priority: apiTicket.priority as string,
        category: apiTicket.category as string,
        submitterName: apiTicket.submitterName as string,
        submitterEmail: apiTicket.submitterEmail as string,
        submitterPhone: apiTicket.submitterPhone as string | undefined,
        submitterDepartment: apiTicket.submitterDepartment as string | undefined,
        assignedTo: apiTicket.assignedTo as string | undefined,
        assignedToId: apiTicket.assignedToId as number | undefined,
        collaborators: (apiTicket.collaborators as string[]) || [],
        collaboratorIds: (apiTicket.collaboratorIds as number[]) || [],
        createdAt: new Date(apiTicket.createdAt as string),
        updatedAt: new Date(apiTicket.updatedAt as string),
        resolvedAt: apiTicket.resolvedAt ? new Date(apiTicket.resolvedAt as string) : undefined,
        slaDeadline: apiTicket.slaDeadline ? new Date(apiTicket.slaDeadline as string) : undefined,
        slaPausedAt: apiTicket.slaPausedAt ? new Date(apiTicket.slaPausedAt as string) : undefined,
        slaStatus: apiTicket.slaStatus as SLAStatus,
        notes: ((apiTicket.notes as Array<Record<string, unknown>>) || []).map(note => ({
            id: note.id as number,
            content: note.content as string,
            author: note.author as string,
            createdAt: new Date(note.createdAt as string),
            isInternal: note.isInternal as boolean,
            imageUrl: note.imageUrl as string | undefined,
        })),
        resolutionSummary: apiTicket.resolutionSummary as string | undefined,
        resolutionImageUrl: apiTicket.resolutionImageUrl as string | undefined,
        imageUrl: apiTicket.imageUrl as string | undefined,
    };
}

// ─────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────

export async function getTickets(filters?: {
    status?: string;
    priority?: string;
    category?: string;
    assignedTo?: string;
    search?: string;
    is_resolved?: boolean;
    page?: number;
    per_page?: number;
}): Promise<{ tickets: Ticket[]; total: number }> {
    const response = await ticketsApi.getAll(filters);

    if (!response.success || !response.data) {
        console.error('Failed to fetch tickets:', response.error);
        return { tickets: [], total: 0 };
    }

    return {
        tickets: response.data.tickets.map((t: any) => mapApiTicket(t as unknown as Record<string, unknown>)),
        total: response.data.total
    };
}

export async function getTicketById(id: string): Promise<Ticket | null> {
    const response = await ticketsApi.getById(id);

    if (!response.success || !response.data) {
        console.error('Failed to fetch ticket:', response.error);
        return null;
    }

    return mapApiTicket(response.data.ticket as unknown as Record<string, unknown>);
}

export async function createTicket(ticket: {
    title: string;
    description: string;
    category: string;
    priority?: string;
    submitterName: string;
    submitterEmail: string;
    submitterPhone?: string;
    submitterDepartment?: string;
}, image?: File, idempotencyKey?: string): Promise<Ticket | null> {
    const response = await ticketsApi.create(ticket, image, idempotencyKey);

    if (!response.success || !response.data) {
        console.error('Failed to create ticket:', response.error);
        return null;
    }

    const data = response.data as { ticket: Record<string, unknown> };
    return mapApiTicket(data.ticket);
}

export async function updateTicket(id: string, data: Partial<Record<string, unknown>>): Promise<Ticket | null> {
    const response = await ticketsApi.update(id, data as Record<string, unknown>);

    if (!response.success || !response.data) {
        console.error('Failed to update ticket:', response.error);
        return null;
    }

    const respData = response.data as { ticket: Record<string, unknown> };
    return mapApiTicket(respData.ticket);
}

export async function deleteTicket(id: string): Promise<boolean> {
    const response = await ticketsApi.delete(id);
    return response.success;
}

export async function assignTicket(id: string, userId: string | null): Promise<Ticket | null> {
    const response = await ticketsApi.assign(id, userId);

    if (!response.success || !response.data) {
        console.error('Failed to assign ticket:', response.error);
        return null;
    }

    const data = response.data as { ticket: Record<string, unknown> };
    return mapApiTicket(data.ticket);
}

export async function updateTicketPriority(id: string, priority: string): Promise<Ticket | null> {
    const response = await ticketsApi.update(id, { priority });

    if (!response.success || !response.data) {
        console.error('Failed to update ticket priority:', response.error);
        return null;
    }

    const data = response.data as { ticket: Record<string, unknown> };
    return mapApiTicket(data.ticket);
}

export async function updateTicketStatus(
    id: string,
    status: string,
    resolutionSummary?: string,
    resolvedAt?: string,
    resolutionImage?: File
): Promise<Ticket | null> {
    const response = await ticketsApi.updateStatus(id, status, resolutionSummary, resolvedAt, resolutionImage);

    if (!response.success || !response.data) {
        console.error('Failed to update ticket status:', response.error);
        return null;
    }

    const data = response.data as { ticket: Record<string, unknown> };
    return mapApiTicket(data.ticket);
}

export async function addTicketNote(
    id: string,
    content: string,
    isInternal: boolean = false,
    image?: File
): Promise<TicketNote | null> {
    const response = await ticketsApi.addNote(id, content, isInternal, image);

    if (!response.success || !response.data) {
        console.error('Failed to add note:', response.error);
        return null;
    }

    const data = response.data as unknown as { note: Record<string, unknown> };
    return {
        id: data.note.id as number,
        content: data.note.content as string,
        author: data.note.author as string,
        createdAt: new Date(data.note.createdAt as string),
        isInternal: data.note.isInternal as boolean,
        imageUrl: data.note.imageUrl as string | undefined,
    };
}

export async function getTicketStats(personal: boolean = false): Promise<{
    total: number;
    open: number;
    new: number;
    assigned: number;
    resolved: number;
    workedOn: number;
    sla: {
        breached: number;
        warning: number;
        healthy: number;
    };
    byPriority: Record<string, number>;
    byCategory: Record<string, number>;
    byDepartment: Record<string, number>;
    trend: Array<{
        day: string;
        created: number;
        resolved: number;
    }>;
    avgResolutionTime: number;
} | null> {
    const response = await ticketsApi.getStats(personal);

    if (!response.success || !response.data) {
        console.error('Failed to fetch stats:', response.error);
        return null;
    }

    return response.data.stats as unknown as {
        total: number;
        open: number;
        new: number;
        assigned: number;
        resolved: number;
        workedOn: number;
        sla: {
            breached: number;
            warning: number;
            healthy: number;
        };
        byPriority: Record<string, number>;
        byCategory: Record<string, number>;
        byDepartment: Record<string, number>;
        trend: Array<{
            day: string;
            created: number;
            resolved: number;
        }>;
        avgResolutionTime: number;
    };
}

export async function getAgents(): Promise<Agent[]> {
    const response = await usersApi.getAgents();

    if (!response.success || !response.data) {
        console.error('Failed to fetch agents:', response.error);
        return [];
    }

    return response.data.agents;
}

export async function getAllAgentsPerformance() {
    const response = await usersApi.getAllPerformance();

    if (!response.success || !response.data) {
        console.error('Failed to fetch agent performance:', response.error);
        return [];
    }

    return response.data.performance;
}
