import { api } from './client';

export interface Account {
    id: string;
    name: string;
    broker: string | null;
    accountType: string;
    currency: string;
    balance: number;
    equity: number;
    accountLogin: string | null;
    server: string | null;
    lastSeen: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    // Enriched stats
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    maxDrawdown: number;
    status: 'CONNECTED' | 'OFFLINE';
    // Only present on creation
    apiKey?: string;
}

export interface AccountStats {
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    avgPnl: number;
    profitFactor: number;
    maxDrawdown: number;
    bestTrade: number;
    worstTrade: number;
    avgWin: number;
    avgLoss: number;
    expectancy: number;
    equityCurve: { date: string; equity: number }[];
}

export const accountsApi = {
    getAll: async (): Promise<Account[]> => {
        const { data } = await api.get<Account[]>('/accounts');
        return data;
    },

    create: async (payload: {
        name?: string;
        broker?: string;
        server: string;
        accountLogin: string;
        password?: string;
    }): Promise<Account> => {
        const { data } = await api.post<Account>('/accounts', payload);
        return data;
    },

    update: async (
        id: string,
        payload: { name?: string; broker?: string },
    ): Promise<Account> => {
        const { data } = await api.patch<Account>(`/accounts/${id}`, payload);
        return data;
    },

    toggle: async (id: string): Promise<Account> => {
        const { data } = await api.patch<Account>(`/accounts/${id}/toggle`);
        return data;
    },

    regenerateKey: async (id: string): Promise<{ apiKey: string }> => {
        const { data } = await api.post<{ apiKey: string }>(
            `/accounts/${id}/regenerate-key`,
        );
        return data;
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/accounts/${id}`);
    },

    getStats: async (id: string): Promise<AccountStats> => {
        const { data } = await api.get<AccountStats>(`/accounts/${id}/stats`);
        return data;
    },
};
