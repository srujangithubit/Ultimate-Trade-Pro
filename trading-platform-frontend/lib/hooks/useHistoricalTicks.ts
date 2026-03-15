'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Tick } from '@/lib/types/trading';

interface UseHistoricalTicksParams {
    symbol: string;
    from: string;
    to: string;
    enabled?: boolean;
}

export function useHistoricalTicks({
    symbol,
    from,
    to,
    enabled = false,
}: UseHistoricalTicksParams) {
    const { data, isLoading, error, dataUpdatedAt } = useQuery<Tick[]>({
        queryKey: ['ticks', symbol, from, to],
        queryFn: async () => {
            const response = await api.get<Tick[]>('/charts/ticks', {
                params: { symbol, from, to },
            });
            return response.data;
        },
        enabled: enabled && !!symbol && !!from && !!to,
        staleTime: Infinity,
        gcTime: 10 * 60 * 1000,
    });

    return {
        ticks: data ?? [],
        isLoading,
        error,
        progress: isLoading ? 0 : data ? 100 : 0,
        dataUpdatedAt,
    };
}
