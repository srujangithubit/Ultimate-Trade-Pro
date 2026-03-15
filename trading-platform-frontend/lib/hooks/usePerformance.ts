'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { PerformanceStats, EquityCurvePoint } from '@/lib/types/trading';

interface PerformanceResponse {
    stats: PerformanceStats;
    equityCurve: EquityCurvePoint[];
}

interface UsePerformanceParams {
    from?: string;
    to?: string;
}

export function usePerformance({ from, to }: UsePerformanceParams = {}) {
    const { data, isLoading, error } = useQuery<PerformanceResponse>({
        queryKey: ['performance', from, to],
        queryFn: async () => {
            const params: Record<string, string> = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const response = await api.get<PerformanceResponse>('/charts/performance', { params });
            return response.data;
        },
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
    });

    return {
        stats: data?.stats ?? null,
        equityCurve: data?.equityCurve ?? [],
        isLoading,
        error,
    };
}
