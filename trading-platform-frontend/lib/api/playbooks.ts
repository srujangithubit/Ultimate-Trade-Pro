import { api } from './client';

export interface Playbook {
    id: string;
    name: string;
    description: string | null;
    rules: string[];
    tags: string[];
    totalTrades: number;
    winRate: number;
    avgRR: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreatePlaybookPayload {
    name: string;
    description?: string;
    rules?: string[];
    tags?: string[];
}

export interface UpdatePlaybookPayload {
    name?: string;
    description?: string;
    rules?: string[];
    tags?: string[];
}

export const playbooksApi = {
    getAll: async (): Promise<Playbook[]> => {
        const { data } = await api.get<Playbook[]>('/playbooks');
        return data;
    },

    getOne: async (id: string): Promise<Playbook> => {
        const { data } = await api.get<Playbook>(`/playbooks/${id}`);
        return data;
    },

    create: async (payload: CreatePlaybookPayload): Promise<Playbook> => {
        const { data } = await api.post<Playbook>('/playbooks', payload);
        return data;
    },

    update: async (id: string, payload: UpdatePlaybookPayload): Promise<Playbook> => {
        const { data } = await api.patch<Playbook>(`/playbooks/${id}`, payload);
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/playbooks/${id}`);
    },
};
