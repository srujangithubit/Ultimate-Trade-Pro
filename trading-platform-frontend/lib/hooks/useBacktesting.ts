'use client';

import { useState, useEffect } from 'react';
import { mockBacktestingSessions, mockPositions } from '@/lib/api/mock-data';

interface BacktestingSession {
    id: string;
    name: string;
    instrument: string;
    timeframe: string;
    startDate: string;
    endDate: string;
    startingBalance: number;
    currentBalance: number;
    status: 'active' | 'completed' | 'paused';
    totalTrades: number;
    winRate: number;
    pnl: number;
    currentTimestamp?: string;
}

export function useBacktesting(sessionId?: string) {
    const [session, setSession] = useState<BacktestingSession | null>(null);
    const [sessions, setSessions] = useState<BacktestingSession[]>([]);
    const [positions, setPositions] = useState(mockPositions);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate API call
        const timer = setTimeout(() => {
            setSessions(mockBacktestingSessions as BacktestingSession[]);

            if (sessionId) {
                const found = mockBacktestingSessions.find((s) => s.id === sessionId);
                setSession((found as BacktestingSession) || (mockBacktestingSessions[0] as BacktestingSession));
            }

            setPositions(mockPositions);
            setIsLoading(false);
        }, 500);

        return () => clearTimeout(timer);
    }, [sessionId]);

    return { session, sessions, positions, isLoading, setPositions };
}
