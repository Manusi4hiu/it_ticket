/**
 * API Service - Centralized API client for backend communication
 */

import type { Ticket, TicketNote, TicketStats, CreateTicketPayload } from '~/types/ticket.types';
import type { User, Agent, UserPerformanceSummary, UserPerformanceDetail, CreateUserPayload } from '~/types/user.types';

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------
const isServer = typeof window === 'undefined';

/** Returns the API base URL depending on execution context (SSR vs client). */
const getApiBaseUrl = () => {
    if (isServer) {
        const envUrl = typeof process !== 'undefined' ? process.env.API_URL : null;
        const baseUrl = envUrl || 'http://127.0.0.1:5000/api';
        return baseUrl.trim().replace(/\/$/, '');
    }
    return ((import.meta.env.VITE_API_URL as string) || '/api').trim().replace(/\/$/, '');
};

const API_BASE_URL = getApiBaseUrl();

// ---------------------------------------------------------------------------
// Minimal logger — only emits in development to avoid leaking internals in
// production browser consoles or server logs.
// ---------------------------------------------------------------------------
const isDev = typeof process !== 'undefined'
    ? process.env.NODE_ENV !== 'production'
    : import.meta.env.DEV;

const logger = {
    log: (...args: unknown[]) => { if (isDev) console.log(...args); },
    warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
    error: (...args: unknown[]) => { console.error(...args); }, // always show errors
};

// ---------------------------------------------------------------------------
// Auth token — held in memory only.
//
// The JWT is stored in an httpOnly cookie (managed by the React Router SSR
// session layer in session.service.ts).  We keep a transient in-memory copy
// so that client-side fetch calls made after SSR hydration can attach the
// Authorization header without re-reading the cookie (which is httpOnly and
// therefore inaccessible to JS anyway).
//
// ⚠️  Do NOT persist the token in localStorage or sessionStorage —
//     those APIs are accessible to any JS running on the page and are
//     therefore vulnerable to XSS attacks.
// ---------------------------------------------------------------------------
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
    authToken = token;
}

export function getAuthToken(): string | null {
    return authToken;
}

export function clearAuthToken() {
    authToken = null;
}

// ---------------------------------------------------------------------------
// Core request utility
// ---------------------------------------------------------------------------
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

interface ApiRequestOptions extends RequestInit {
    idempotencyKey?: string;
    maxRetries?: number;
}

export async function apiRequest<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
    const { idempotencyKey, maxRetries = 3, ...fetchOptions } = options;
    const token = getAuthToken();

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers as Record<string, string>),
    };

    if (fetchOptions.body instanceof FormData) {
        delete headers['Content-Type'];
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (idempotencyKey) {
        headers['X-Idempotency-Key'] = idempotencyKey;
    }

    if (isServer) {
        headers['Connection'] = 'close';
    }

    // Ensure endpoint starts with /
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${API_BASE_URL}${normalizedEndpoint}`;

    logger.log(`[API] ${fetchOptions.method || 'GET'} ${fullUrl}`);

    let retries = 0;
    const executeRequest = async (): Promise<ApiResponse<T>> => {
        try {
            const response = await fetch(fullUrl, {
                ...fetchOptions,
                headers,
            });

            logger.log(`[API] Response: ${response.status} ${response.statusText}`);

            // Retry on transient server errors
            if ([502, 503, 504].includes(response.status) && retries < maxRetries) {
                retries++;
                const delay = Math.pow(2, retries) * 1000;
                logger.warn(`[API] Retry ${retries} in ${delay}ms…`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return executeRequest();
            }

            let data: unknown;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (parseError) {
                    logger.error('[API] JSON parse error:', parseError);
                    return { success: false, error: 'Invalid JSON response from server' };
                }
            } else {
                const text = await response.text();
                logger.warn('[API] Non-JSON response:', text.substring(0, 100));
                return { success: false, error: `Server returned ${response.status} (Non-JSON)` };
            }

            if (!response.ok) {
                logger.warn('[API] Request failed:', response.status);
                const errData = data as Record<string, string> | undefined;
                return {
                    success: false,
                    error: (errData?.error || errData?.msg || `HTTP error ${response.status}`) as string,
                };
            }

            return { success: true, data: data as T };
        } catch (error) {
            logger.error(`[API] Fetch error for ${fullUrl}:`, error);

            if (retries < maxRetries) {
                retries++;
                const delay = Math.pow(2, retries) * 1000;
                logger.warn(`[API] Network retry ${retries}…`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return executeRequest();
            }

            return {
                success: false,
                error: error instanceof Error ? `Network error: ${error.message}` : 'Network error',
            };
        }
    };

    return executeRequest();
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
export const authApi = {
    login: async (username: string, password: string) =>
        apiRequest<{ success: boolean; token: string; user: User }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }),

    logout: async () => apiRequest('/auth/logout', { method: 'POST' }),

    me: async () => apiRequest<{ success: boolean; user: User }>('/auth/me'),
};

// ---------------------------------------------------------------------------
// Tickets API
// ---------------------------------------------------------------------------
export const ticketsApi = {
    getAll: async (filters?: {
        status?: string;
        priority?: string;
        category?: string;
        assignedTo?: string;
        search?: string;
        is_resolved?: boolean;
        page?: number;
        per_page?: number;
    }) => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    params.append(key, String(value));
                }
            });
        }
        const queryString = params.toString();
        return apiRequest<{ success: boolean; tickets: Ticket[]; total: number; page?: number; per_page?: number }>(
            `/tickets${queryString ? `?${queryString}` : ''}`
        );
    },

    getById: async (id: string) =>
        apiRequest<{ success: boolean; ticket: Ticket }>(`/tickets/${id}`),

    create: async (ticket: CreateTicketPayload, image?: File, idempotencyKey?: string) => {
        if (image) {
            const formData = new FormData();
            Object.entries(ticket).forEach(([key, value]) => {
                if (value !== undefined) formData.append(key, value as string);
            });
            formData.append('image', image);
            return apiRequest('/tickets', {
                method: 'POST',
                body: formData,
                headers: {},
                idempotencyKey,
                maxRetries: 3,
            });
        }
        return apiRequest('/tickets', {
            method: 'POST',
            body: JSON.stringify(ticket),
            idempotencyKey,
            maxRetries: 3,
        });
    },

    update: async (id: string, data: Record<string, unknown>) =>
        apiRequest(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: async (id: string) =>
        apiRequest(`/tickets/${id}`, { method: 'DELETE' }),

    assign: async (id: string, userId: string | null) =>
        apiRequest(`/tickets/${id}/assign`, { method: 'PUT', body: JSON.stringify({ userId }) }),

    updateStatus: async (id: string, status: string, resolutionSummary?: string, resolvedAt?: string) =>
        apiRequest(`/tickets/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, resolutionSummary, resolvedAt }),
        }),

    addNote: async (id: string, content: string, isInternal: boolean = false, image?: File) => {
        if (image) {
            const formData = new FormData();
            formData.append('content', content);
            formData.append('isInternal', String(isInternal));
            formData.append('image', image);
            return apiRequest<{ success: boolean; note: TicketNote }>(`/tickets/${id}/notes`, {
                method: 'POST',
                body: formData,
                headers: {},
            });
        }
        return apiRequest<{ success: boolean; note: TicketNote }>(`/tickets/${id}/notes`, {
            method: 'POST',
            body: JSON.stringify({ content, isInternal }),
        });
    },

    getStats: async (personal: boolean = false) =>
        apiRequest<{ success: boolean; stats: TicketStats }>(
            `/tickets/stats${personal ? '?personal=true' : ''}`
        ),
};

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------
export const usersApi = {
    getAll: async () =>
        apiRequest<{ success: boolean; users: User[]; total: number }>('/users'),

    getAgents: async () =>
        apiRequest<{ success: boolean; agents: Agent[] }>('/users/agents'),

    getById: async (id: string) =>
        apiRequest<{ success: boolean; user: User }>(`/users/${id}`),

    getPerformance: async (id: string) =>
        apiRequest<{ success: boolean; performance: UserPerformanceDetail }>(`/users/${id}/performance`),

    create: async (user: CreateUserPayload) =>
        apiRequest('/users', { method: 'POST', body: JSON.stringify(user) }),

    update: async (id: string, data: Record<string, unknown>) =>
        apiRequest(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    delete: async (id: string) =>
        apiRequest(`/users/${id}`, { method: 'DELETE' }),

    getAllPerformance: async () =>
        apiRequest<{ success: boolean; performance: UserPerformanceSummary[] }>('/users/performance'),
};
