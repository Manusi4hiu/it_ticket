/**
 * API Service - Centralized API client for backend communication
 */

const API_BASE_URL = 'http://127.0.0.1:5000/api';

// Token storage
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
    authToken = token;
    if (token) {
        if (typeof window !== 'undefined') {
            localStorage.setItem('auth_token', token);
        }
    } else {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
        }
    }
}

export function getAuthToken(): string | null {
    if (authToken) return authToken;
    if (typeof window !== 'undefined') {
        authToken = localStorage.getItem('auth_token');
    }
    return authToken;
}

export function clearAuthToken() {
    authToken = null;
    if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
    }
}

interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const token = getAuthToken();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (options.body instanceof FormData) {
        delete (headers as Record<string, string>)['Content-Type'];
    }

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || data.msg || `HTTP error ${response.status}`,
            };
        }

        return {
            success: true,
            data,
        };
    } catch (error) {
        console.error('API request error:', error);
        return {
            success: false,
            error: 'Network error. Please check your connection.',
        };
    }
}

// Auth API
export const authApi = {
    login: async (username: string, password: string) => {
        return apiRequest<{
            success: boolean;
            token: string;
            user: {
                id: string;
                email: string;
                username: string;
                full_name: string;
                role: string;
                department: string | null;
                phone: string | null;
                avatar_url: string | null;
            };
        }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
    },

    logout: async () => {
        return apiRequest('/auth/logout', { method: 'POST' });
    },

    me: async () => {
        return apiRequest<{
            success: boolean;
            user: {
                id: string;
                email: string;
                username: string;
                full_name: string;
                role: string;
                department: string | null;
                phone: string | null;
                avatar_url: string | null;
            };
        }>('/auth/me');
    },
};

// Tickets API
export const ticketsApi = {
    getAll: async (filters?: {
        status?: string;
        priority?: string;
        category?: string;
        assignedTo?: string;
        search?: string;
    }) => {
        const params = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value) params.append(key, value);
            });
        }
        const queryString = params.toString();
        return apiRequest<{
            success: boolean;
            tickets: Array<{
                id: string;
                title: string;
                description: string;
                status: string;
                priority: string;
                category: string;
                submitterName: string;
                submitterEmail: string;
                submitterPhone?: string;
                submitterDepartment?: string;
                assignedTo?: string;
                assignedToId?: string;
                collaborators: string[];
                slaDeadline?: string;
                slaStatus: string;
                resolutionSummary?: string;
                resolvedAt?: string;
                createdAt: string;
                updatedAt: string;
                notes?: Array<{
                    id: string;
                    content: string;
                    author: string;
                    createdAt: string;
                    isInternal: boolean;
                }>;
            }>;
            total: number;
        }>(`/tickets${queryString ? `?${queryString}` : ''}`);
    },

    getById: async (id: string) => {
        return apiRequest<{
            success: boolean;
            ticket: {
                id: string;
                title: string;
                description: string;
                status: string;
                priority: string;
                category: string;
                submitterName: string;
                submitterEmail: string;
                submitterPhone?: string;
                submitterDepartment?: string;
                assignedTo?: string;
                assignedToId?: string;
                collaborators: string[];
                slaDeadline?: string;
                slaStatus: string;
                resolutionSummary?: string;
                resolvedAt?: string;
                createdAt: string;
                updatedAt: string;
                notes: Array<{
                    id: string;
                    content: string;
                    author: string;
                    createdAt: string;
                    isInternal: boolean;
                }>;
            };
        }>(`/tickets/${id}`);
    },

    create: async (ticket: {
        title: string;
        description: string;
        category: string;
        priority?: string;
        submitterName: string;
        submitterEmail: string;
        submitterPhone?: string;
        submitterDepartment?: string;
    }, image?: File) => {
        if (image) {
            const formData = new FormData();
            Object.entries(ticket).forEach(([key, value]) => {
                if (value !== undefined) formData.append(key, value);
            });
            formData.append('image', image);

            return apiRequest('/tickets', {
                method: 'POST',
                body: formData,
                headers: {}, // Let fetch set Content-Type
            });
        }

        return apiRequest('/tickets', {
            method: 'POST',
            body: JSON.stringify(ticket),
        });
    },

    update: async (id: string, data: Record<string, unknown>) => {
        return apiRequest(`/tickets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest(`/tickets/${id}`, { method: 'DELETE' });
    },

    assign: async (id: string, userId: string | null) => {
        return apiRequest(`/tickets/${id}/assign`, {
            method: 'PUT',
            body: JSON.stringify({ userId }),
        });
    },

    updateStatus: async (id: string, status: string, resolutionSummary?: string) => {
        return apiRequest(`/tickets/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, resolutionSummary }),
        });
    },

    addNote: async (id: string, content: string, isInternal: boolean = false, image?: File) => {
        if (image) {
            const formData = new FormData();
            formData.append('content', content);
            formData.append('isInternal', String(isInternal));
            formData.append('image', image);

            return apiRequest<{
                success: boolean;
                note: {
                    id: string;
                    content: string;
                    author: string;
                    createdAt: string;
                    isInternal: boolean;
                    imageUrl?: string;
                };
            }>(`/tickets/${id}/notes`, {
                method: 'POST',
                body: formData,
                headers: {}, // Let fetch set Content-Type for FormData
            });
        }

        return apiRequest<{
            success: boolean;
            note: {
                id: string;
                content: string;
                author: string;
                createdAt: string;
                isInternal: boolean;
                imageUrl?: string;
            };
        }>(`/tickets/${id}/notes`, {
            method: 'POST',
            body: JSON.stringify({ content, isInternal }),
        });
    },

    getStats: async () => {
        return apiRequest<{
            success: boolean;
            stats: {
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
            };
        }>('/tickets/stats');
    },
};

// Users API
export const usersApi = {
    getAll: async () => {
        return apiRequest<{
            success: boolean;
            users: Array<{
                id: string;
                email: string;
                username: string;
                full_name: string;
                role: string;
                department: string | null;
                phone: string | null;
                avatar_url: string | null;
            }>;
        }>('/users');
    },

    getAgents: async () => {
        return apiRequest<{
            success: boolean;
            agents: Array<{
                id: string;
                name: string;
                username: string;
                email: string;
            }>;
        }>('/users/agents');
    },

    getById: async (id: string) => {
        return apiRequest<{
            success: boolean;
            user: {
                id: string;
                email: string;
                username: string;
                full_name: string;
                role: string;
                department: string | null;
                phone: string | null;
                avatar_url: string | null;
            };
        }>(`/users/${id}`);
    },

    getPerformance: async (id: string) => {
        return apiRequest<{
            success: boolean;
            performance: {
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
            };
        }>(`/users/${id}/performance`);
    },

    create: async (user: {
        email?: string | null;
        username: string;
        password: string;
        full_name: string;
        role: string;
        department?: string | null;
        phone?: string | null;
    }) => {
        return apiRequest('/users', {
            method: 'POST',
            body: JSON.stringify(user),
        });
    },

    update: async (id: string, data: Record<string, unknown>) => {
        return apiRequest(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest(`/users/${id}`, { method: 'DELETE' });
    },

    getAllPerformance: async () => {
        return apiRequest<{
            success: boolean;
            performance: Array<{
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
            }>;
        }>('/users/performance');
    },
};
