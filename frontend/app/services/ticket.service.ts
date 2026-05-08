/**
 * Ticket Service - Using backend API
 */

import { ticketsApi, usersApi } from './api.service';

export type TicketStatus = string;
export type TicketPriority = string;
export type SLAStatus = "good" | "warning" | "breached";
export type TicketCategory = string;

export interface TicketNote {
    id: number;
    content: string;
    author: string;
    createdAt: Date;
    isInternal: boolean;
    imageUrl?: string;
}

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
    assignedTo?: string;
    assignedToId?: number;
    collaborators: string[];
    collaboratorIds: number[];
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date;
    slaDeadline: Date;
    slaStatus: SLAStatus;
    notes: TicketNote[];
    resolutionSummary?: string;
    imageUrl?: string;
}

export interface Agent {
    id: number;
    name: string;
    username: string;
    email: string;
    phone?: string;
}

// Convert API response to Ticket interface
function mapApiTicket(apiTicket: Record<string, unknown>): Ticket {
    return {
        id: apiTicket.id as number,
        ticketCode: apiTicket.ticketCode as string | undefined,
        title: apiTicket.title as string,
        description: apiTicket.description as string,
        status: apiTicket.status as TicketStatus,
        priority: apiTicket.priority as TicketPriority,
        category: apiTicket.category as TicketCategory,
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
        slaDeadline: new Date(apiTicket.slaDeadline as string),
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
        imageUrl: apiTicket.imageUrl as string | undefined,
    };
}

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
    category: TicketCategory;
    priority?: TicketPriority;
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

export async function updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | null> {
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
    status: TicketStatus,
    resolutionSummary?: string
): Promise<Ticket | null> {
    const response = await ticketsApi.updateStatus(id, status, resolutionSummary);

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

    const data = response.data as { note: Record<string, unknown> };
    return {
        id: data.note.id as string,
        content: data.note.content as string,
        author: data.note.author as string,
        createdAt: new Date(data.note.createdAt as string),
        isInternal: data.note.isInternal as boolean,
        imageUrl: data.note.imageUrl as string | undefined,
    };
}

export async function getTicketStats(personal: boolean = false): Promise<{
    total: number;
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

    return response.data.stats;
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
