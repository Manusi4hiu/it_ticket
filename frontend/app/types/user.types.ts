/**
 * Shared User Types
 *
 * Single source of truth for all User-related interfaces.
 * Import from here instead of defining inline types per service/component.
 */

export interface User {
    id: string;
    email: string | null;
    username: string;
    full_name: string;
    role: string;
    department: string | null;
    phone: string | null;
    avatar_url: string | null;
}

export interface Agent {
    id: string;
    name: string;
    username: string;
    email: string;
    phone?: string | null;
}

export interface UserPerformanceSummary {
    id: string;
    name: string;
    username: string;
    email: string;
    totalAssigned: number;
    resolved: number;
    inProgress: number;
    pending: number;
    avgResolutionTime: number;
    slaCompliance: number;
    priorityBreakdown: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

export interface UserPerformanceDetail {
    user: {
        id: string;
        full_name: string;
        username: string;
        email: string;
        role: string;
    };
    totalAssigned: number;
    resolved: number;
    closed: number;
    inProgress: number;
    slaCompliance: number;
    slaBreach: number;
    recentTickets: Array<{
        id: string;
        title: string;
        status: string;
        priority: string;
    }>;
}

export interface CreateUserPayload {
    email?: string | null;
    username: string;
    password: string;
    full_name: string;
    role: string;
    department?: string | null;
    phone?: string | null;
}
