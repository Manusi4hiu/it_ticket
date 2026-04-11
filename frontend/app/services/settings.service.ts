import { apiRequest } from "./api.service";

export interface Category {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
}

export interface Priority {
    id: string;
    name: string;
    level: number;
    color: string;
    slaHours: number;
    responseTimeMinutes: number;
    description?: string;
    isActive: boolean;
}

export interface Status {
    id: string | number;
    name: string;
    color: string;
    order: number;
    isDefault: boolean;
}

export interface SLAPolicy {
    id: string;
    priorityId?: string;
    categoryId?: string;
    priorityName?: string;
    categoryName?: string;
    responseTimeMinutes: number;
    resolutionTimeHours: number;
}

export const settingsApi = {
    // Categories
    getCategories: async () => {
        return apiRequest<{ success: boolean; data: Category[] }>('/settings/categories');
    },
    createCategory: async (data: Partial<Category>) => {
        return apiRequest<{ success: boolean; data: Category }>('/settings/categories', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    updateCategory: async (id: string, data: Partial<Category>) => {
        return apiRequest<{ success: boolean; data: Category }>(`/settings/categories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    deleteCategory: async (id: string) => {
        return apiRequest(`/settings/categories/${id}`, { method: 'DELETE' });
    },

    // Priorities
    getPriorities: async () => {
        return apiRequest<{ success: boolean; data: Priority[] }>('/settings/priorities');
    },
    createPriority: async (data: Partial<Priority>) => {
        return apiRequest<{ success: boolean; data: Priority }>('/settings/priorities', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    updatePriority: async (id: string, data: Partial<Priority>) => {
        return apiRequest<{ success: boolean; data: Priority }>(`/settings/priorities/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    deletePriority: async (id: string) => {
        return apiRequest(`/settings/priorities/${id}`, { method: 'DELETE' });
    },

    // SLA Policies
    getSLAPolicies: async () => {
        return apiRequest<{ success: boolean; data: SLAPolicy[] }>('/settings/sla-policies');
    },
    createSLAPolicy: async (data: Partial<SLAPolicy>) => {
        return apiRequest<{ success: boolean; data: SLAPolicy }>('/settings/sla-policies', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    updateSLAPolicy: async (id: string, data: Partial<SLAPolicy>) => {
        return apiRequest<{ success: boolean; data: SLAPolicy }>(`/settings/sla-policies/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    deleteSLAPolicy: async (id: string) => {
        return apiRequest(`/settings/sla-policies/${id}`, { method: 'DELETE' });
    },

    // Departments
    getDepartments: async () => {
        return apiRequest<{ success: boolean; data: Department[] }>('/settings/departments');
    },
    createDepartment: async (data: Partial<Department>) => {
        return apiRequest<{ success: boolean; data: Department }>('/settings/departments', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    updateDepartment: async (id: string, data: Partial<Department>) => {
        return apiRequest<{ success: boolean; data: Department }>(`/settings/departments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    deleteDepartment: async (id: string) => {
        return apiRequest(`/settings/departments/${id}`, { method: 'DELETE' });
    },
    // Statuses
    getStatuses: async () => {
        return apiRequest<{ success: boolean; data: Status[] }>('/settings/statuses');
    },
    createStatus: async (data: Partial<Status>) => {
        return apiRequest<{ success: boolean; data: Status }>('/settings/statuses', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    updateStatus: async (id: string, data: Partial<Status>) => {
        return apiRequest<{ success: boolean; data: Status }>(`/settings/statuses/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    deleteStatus: async (id: string) => {
        return apiRequest<{ success: boolean; error?: string }>(`/settings/statuses/${id}`, { method: 'DELETE' });
    },
    // System Logs
    getLogs: async () => {
        return apiRequest<{ success: boolean; data: SystemLog[] }>('/settings/logs');
    }
};

export interface SystemLog {
    id: string;
    timestamp: string;
    action: string;
    details: string;
    ipAddress: string;
    userId?: string;
    userName: string;
    targetId?: string;
    metadata?: string;
}

export interface Department {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
}
