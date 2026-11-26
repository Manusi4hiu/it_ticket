/**
 * API Service - Centralized API client for backend communication
 */

import type { Ticket, TicketNote, TicketStats, CreateTicketPayload } from '~/types/ticket.types';
import type { User, Agent, UserPerformanceSummary, UserPerformanceDetail, CreateUserPayload } from '~/types/user.types';
import { getBaseUrl } from '~/utils/asset';

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
// Auth token management:
// - Browser client: kept in tab memory (no localStorage/sessionStorage for XSS defense).
// - Node SSR server: ALWAYS resolved via AsyncLocalStorage provider registered by
//   ssr-auth.server.ts — never a shared module-level mutable singleton.
// ---------------------------------------------------------------------------
let clientAuthToken: string | null = null;
let serverTokenGetter: (() => string | null) | null = null;

export function registerServerTokenGetter(getter: () => string | null) {
    serverTokenGetter = getter;
}

export function setAuthToken(token: string | null) {
    if (isServer) return;
    clientAuthToken = token;
}

export function getAuthToken(): string | null {
    if (isServer) {
        return serverTokenGetter ? serverTokenGetter() : null;
    }
    return clientAuthToken;
}

export function clearAuthToken() {
    if (isServer) return;
    clientAuthToken = null;
}

// ---------------------------------------------------------------------------
// Client session expiry guard & connection helpers
// ---------------------------------------------------------------------------
const DEFAULT_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 30000;
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
let redirectingToLogin = false;

function isPublicFrontendPath(pathname: string): boolean {
    const base = getBaseUrl().replace(/\/$/, '');
    const route = base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
    return (
        route === '/' ||
        route.startsWith('/login') ||
        route.startsWith('/submit-ticket') ||
        route.startsWith('/ticket/') ||
        route.startsWith('/unauthorized') ||
        route.startsWith('/forbidden')
    );
}

function handleClientUnauthorized(hadAuthToken: boolean) {
    if (isServer || typeof window === 'undefined') return;
    clearAuthToken();
    if (redirectingToLogin) return;
    if (!hadAuthToken && isPublicFrontendPath(window.location.pathname)) return;
    if (isPublicFrontendPath(window.location.pathname) && window.location.pathname.endsWith('/login')) return;
    redirectingToLogin = true;
    window.location.replace(`${getBaseUrl()}login?expired=1`);
}

// ---------------------------------------------------------------------------
// Core request utility
// ---------------------------------------------------------------------------
interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    status?: number;
}

interface ApiRequestOptions extends RequestInit {
    idempotencyKey?: string;
    maxRetries?: number;
    timeoutMs?: number;
    token?: string | null;
}

export async function apiRequest<T>(
    endpoint: string,
    options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
    const {
        idempotencyKey,
        maxRetries,
        timeoutMs,
        token: explicitToken,
        ...fetchOptions
    } = options;
    const token = explicitToken !== undefined ? explicitToken : getAuthToken();

    if (!isServer && typeof navigator !== 'undefined' && navigator.onLine === false) {
        return {
            success: false,
            error: 'Koneksi internet terputus (offline). Periksa Wi-Fi atau data seluler Anda.',
        };
    }

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
    const method = (fetchOptions.method || 'GET').toUpperCase();
    // Only auto-retry idempotent methods or explicitly idempotent requests
    const canRetry = RETRYABLE_METHODS.has(method) || Boolean(idempotencyKey);
    const retryLimit = canRetry ? Math.min(maxRetries ?? 2, 3) : 0;
    const effectiveTimeout = timeoutMs ?? (fetchOptions.body instanceof FormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

    logger.log(`[API] ${method} ${fullUrl}`);

    let retries = 0;
    const executeRequest = async (): Promise<ApiResponse<T>> => {
        const controller = new AbortController();
        const externalSignal = fetchOptions.signal;
        let timedOut = false;

        const onExternalAbort = () => controller.abort();
        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort();
            } else {
                externalSignal.addEventListener('abort', onExternalAbort, { once: true });
            }
        }

        const timer = effectiveTimeout > 0
            ? setTimeout(() => {
                  timedOut = true;
                  controller.abort();
              }, effectiveTimeout)
            : undefined;

        try {
            const response = await fetch(fullUrl, {
                ...fetchOptions,
                signal: controller.signal,
                cache: fetchOptions.cache || 'no-store',
                headers,
            });

            logger.log(`[API] Response: ${response.status} ${response.statusText}`);

            // Retry idempotent requests on transient gateway errors
            if ([502, 503, 504].includes(response.status) && retries < retryLimit) {
                retries++;
                const delay = retries * 750;
                logger.warn(`[API] Retry ${retries} in ${delay}ms…`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return executeRequest();
            }

            if (
                response.status === 401 &&
                !normalizedEndpoint.startsWith('/auth/login') &&
                !normalizedEndpoint.startsWith('/auth/logout')
            ) {
                handleClientUnauthorized(Boolean(token));
            }

            let data: unknown;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (parseError) {
                    logger.error('[API] JSON parse error:', parseError);
                    return { success: false, error: 'Invalid JSON response from server', status: response.status };
                }
            } else {
                const text = await response.text();
                logger.warn('[API] Non-JSON response:', text.substring(0, 100));
                return { success: false, error: `Server returned ${response.status} (Non-JSON)`, status: response.status };
            }

            if (!response.ok) {
                logger.warn('[API] Request failed:', response.status);
                const errData = data as Record<string, string> | undefined;
                return {
                    success: false,
                    error: (errData?.error || errData?.msg || `HTTP error ${response.status}`) as string,
                    status: response.status,
                };
            }

            return { success: true, data: data as T, status: response.status };
        } catch (error) {
            logger.error(`[API] Fetch error for ${fullUrl}:`, error);

            const callerAborted = Boolean(externalSignal?.aborted);
            if (!callerAborted && retries < retryLimit) {
                retries++;
                const delay = retries * 750;
                logger.warn(`[API] Network retry ${retries}…`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return executeRequest();
            }

            if (timedOut) {
                return {
                    success: false,
                    error: 'Koneksi ke server timeout. Periksa jaringan Anda lalu coba lagi.',
                };
            }

            return {
                success: false,
                error: error instanceof Error ? `Network error: ${error.message}` : 'Network error',
            };
        } finally {
            if (timer !== undefined) clearTimeout(timer);
            if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
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
        is_pending?: boolean;
        startDate?: string;
        endDate?: string;
        start_date?: string;
        end_date?: string;
        date?: string;
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
                if (value !== undefined && value !== null) formData.append(key, value as string);
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

    assign: async (id: string, userId: string | null, transferReason?: string) =>
        apiRequest(`/tickets/${id}/assign`, {
            method: 'PUT',
            body: JSON.stringify({ userId, ...(transferReason ? { transferReason } : {}) }),
        }),

    updateStatus: async (id: string, status: string, resolutionSummary?: string, resolvedAt?: string, resolutionImage?: File) => {
        if (resolutionImage) {
            const formData = new FormData();
            formData.append('status', status);
            if (resolutionSummary) formData.append('resolutionSummary', resolutionSummary);
            if (resolvedAt) formData.append('resolvedAt', resolvedAt);
            formData.append('resolutionImage', resolutionImage);
            return apiRequest(`/tickets/${id}/status`, {
                method: 'PUT', body: formData, headers: {},
            });
        }
        return apiRequest(`/tickets/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, resolutionSummary, resolvedAt }),
        });
    },

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

    getStats: async (personal: boolean = false, days?: number, opts?: { start?: string; end?: string }) => {
        const params = new URLSearchParams();
        if (personal) params.set("personal", "true");
        if (days) params.set("days", String(days));
        if (opts?.start) params.set("start", opts.start);
        if (opts?.end) params.set("end", opts.end);
        const qs = params.toString();
        return apiRequest<{ success: boolean; stats: TicketStats }>(
            `/tickets/stats${qs ? `?${qs}` : ''}`
        );
    },
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

    getAllPerformance: async (opts?: { start?: string; end?: string }) => {
        const params = new URLSearchParams();
        if (opts?.start) params.set("start", opts.start);
        if (opts?.end) params.set("end", opts.end);
        const qs = params.toString();
        return apiRequest<{ success: boolean; performance: UserPerformanceSummary[] }>(
            `/users/performance${qs ? `?${qs}` : ''}`
        );
    },

    toggleActive: async (id: string) =>
        apiRequest<{ success: boolean; user: User; message: string }>(`/users/${id}/toggle-active`, { method: 'PATCH' }),

    toggleBreak: async (id: string) => {
        const res = await apiRequest<User>(`/users/${id}/break`, { method: 'POST' });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('break-toggled'));
        return res;
    },

    getBreakSummary: async (period: 'daily' | 'weekly' | 'monthly' = 'daily') =>
        apiRequest<{
            success: boolean;
            period: string;
            range: { start: string; end: string };
            limits: { perSession: number; daily: number; weekly: number; monthly: number };
            limitMinutes: number;
            summary: Array<{
                userId: number;
                userName: string;
                username: string;
                role: string;
                isOnBreak: boolean;
                liveSeconds: number;
                usedSeconds: number;
                sessionsCount: number;
                limitMinutes: number;
                remainingSeconds: number;
            }>;
        }>(`/users/break-summary?period=${period}`),

    setPresenceStatus: async (id: string | number, status: 'online' | 'idle' | 'dnd' | 'offline', message?: string | null, clearAfterMinutes?: number | null) =>
        apiRequest<{ success: boolean; presenceStatus: string; customStatusMessage?: string; customStatusExpiresAt?: string }>(`/users/${id}/presence-status`, {
            method: 'PATCH',
            body: JSON.stringify({ status, message, clearAfterMinutes }),
        }),

    getBreakLogs: async (params?: { period?: string; user_id?: string | number; limit?: number }) => {
        const qs = new URLSearchParams();
        if (params?.period) qs.set('period', params.period);
        if (params?.user_id !== undefined) qs.set('user_id', String(params.user_id));
        if (params?.limit !== undefined) qs.set('limit', String(params.limit));
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        return apiRequest<{
            success: boolean;
            period: string;
            range: { start: string; end: string };
            total: number;
            logs: Array<{
                id: number;
                userId: number;
                userName: string | null;
                startedAt: string | null;
                endedAt: string | null;
                durationSeconds: number;
                logDate: string | null;
            }>;
        }>(`/users/break-logs${suffix}`);
    },
};

// ---------------------------------------------------------------------------
// Notifications & Web Push API
// ---------------------------------------------------------------------------
export interface NotificationItemDto {
    id: number;
    ticketId?: number | null;
    ticketCode?: string | null;
    type: string;
    title: string;
    message: string;
    reason?: string | null;
    createdAt: string;
    isRead: boolean;
}

export const notificationsApi = {
    getAll: async (limit: number = 50, unreadOnly: boolean = false) =>
        apiRequest<{ success: boolean; notifications: NotificationItemDto[]; unreadCount: number }>(
            `/notifications?limit=${limit}&unread_only=${unreadOnly}`
        ),

    markRead: async (ids: number[]) =>
        apiRequest<{ success: boolean; updated: number; unreadCount: number }>('/notifications/read', {
            method: 'PUT',
            body: JSON.stringify({ ids }),
        }),

    deleteItems: async (payload: { ids?: number[]; all?: boolean }) =>
        apiRequest<{ success: boolean; deleted: number; unreadCount: number }>('/notifications/delete', {
            method: 'PUT',
            body: JSON.stringify(payload),
        }),

    getVapidPublicKey: async () =>
        apiRequest<{ success: boolean; publicKey: string }>('/notifications/vapid-public-key'),
};
