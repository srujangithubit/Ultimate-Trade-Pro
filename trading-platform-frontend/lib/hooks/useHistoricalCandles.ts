'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Candle, Timeframe } from '@/lib/types/trading';

interface UseHistoricalCandlesParams {
    symbol: string;
    timeframe: Timeframe;
    from: string;
    to: string;
    enabled?: boolean;
}

export function useHistoricalCandles({
    symbol,
    timeframe,
    from,
    to,
    enabled = true,
}: UseHistoricalCandlesParams) {
    const { data, isLoading, error } = useQuery<Candle[]>({
        queryKey: ['candles', symbol, timeframe, from, to],
        queryFn: async () => {
            const response = await api.get<Candle[]>('/charts/candles', {
                params: { symbol, timeframe, from, to },
            });
            return response.data;
        },
        enabled: enabled && !!symbol && !!timeframe && !!from && !!to,
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
    });

    return {
        candles: data ?? [],
        isLoading,
        error,
    };
}
