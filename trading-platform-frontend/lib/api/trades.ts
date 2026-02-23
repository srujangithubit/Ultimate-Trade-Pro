
import { api } from './client';

export interface Trade {
    id: string;
    instrument: string;
    direction: 'LONG' | 'SHORT' | 'long' | 'short';
    entryPrice: number;
    exitPrice?: number;
    quantity: number;
    setup: string;
    entryDatetime: string;
    exitDatetime?: string;
    pnl?: number;
    pnlPercent?: number;
    tags: string[];
    notes?: string;
    status: 'OPEN' | 'CLOSED' | 'WIN' | 'LOSS' | 'BE';
}

export interface CreateTradeDto {
    instrument: string;
    direction: 'LONG' | 'SHORT' | 'long' | 'short';
    entryPrice: number;
    exitPrice?: number;
    quantity: number;
    setup: string;
    entryDate: string;
    exitDate?: string;
    tags: string[];
    notes?: string;
}

export const tradesApi = {
    getAll: async () => {
        const { data } = await api.get<{ trades: Trade[] }>('/trades');
        return data.trades;
    },

    create: async (trade: CreateTradeDto) => {
        // Map frontend fields to backend DTO expectations
        const backendPayload = {
            ...trade,
            symbol: trade.instrument,
        };
        const { data } = await api.post<Trade>('/trades', backendPayload);
        return data;
    },

    update: async (id: string, trade: Partial<CreateTradeDto>) => {
        const { data } = await api.patch<Trade>(`/trades/${id}`, trade);
        return data;
    },

    delete: async (id: string) => {
        await api.delete(`/trades/${id}`);
    },

    getStats: async () => {
        // If backend has a dedicated stats endpoint
        // const { data } = await api.get('/analytics/overview');
        // return data;

        // Fallback: Calculate stats from trades
        const { data } = await api.get<{ trades: Trade[] }>('/trades');
        // Simple calculation logic would go here if needed, but better to do it in the component or backend
        return data.trades;
    }
};
