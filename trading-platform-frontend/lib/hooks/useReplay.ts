'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { ReplayEngine } from '@/lib/replay/ReplayEngine';
import { useTradingStore } from '@/lib/stores/tradingStore';
import { useHistoricalTicks } from '@/lib/hooks/useHistoricalTicks';
import type { Tick, ReplaySpeed } from '@/lib/types/trading';

interface UseReplayReturn {
    play: () => void;
    pause: () => void;
    seek: (timestamp: number) => void;
    setSpeed: (speed: ReplaySpeed) => void;
    isPlaying: boolean;
    progress: number;
    currentTimestamp: number;
    isLoading: boolean;
    onReplayTick: (callback: (tick: Tick) => void) => void;
}

export function useReplay(): UseReplayReturn {
    const engineRef = useRef<ReplayEngine | null>(null);
    const tickCallbackRef = useRef<((tick: Tick) => void) | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTimestamp, setCurrentTimestamp] = useState(0);

    const {
        replayActive,
        replayRange,
        replaySpeed,
        activeSymbol,
        setReplayTimestamp,
    } = useTradingStore();

    // Fetch ticks when replay becomes active
    const { ticks, isLoading } = useHistoricalTicks({
        symbol: activeSymbol,
        from: replayRange ? new Date(replayRange.from).toISOString() : '',
        to: replayRange ? new Date(replayRange.to).toISOString() : '',
        enabled: replayActive && replayRange !== null,
    });

    // Initialize engine
    useEffect(() => {
        const engine = new ReplayEngine();
        engineRef.current = engine;

        engine.onTick((tick) => {
            tickCallbackRef.current?.(tick);
            setReplayTimestamp(tick.timestamp);

            // Update progress at lower frequency to avoid excessive re-renders
            const now = engine.progress;
            setProgress(now);
            setCurrentTimestamp(tick.timestamp);
        });

        engine.onComplete(() => {
            setIsPlaying(false);
        });

        return () => {
            engine.destroy();
            engineRef.current = null;
        };
    }, [setReplayTimestamp]);

    // Load ticks into engine when available
    useEffect(() => {
        if (ticks.length > 0 && engineRef.current) {
            engineRef.current.load(ticks);
            setProgress(0);
            setCurrentTimestamp(ticks[0]?.timestamp ?? 0);
        }
    }, [ticks]);

    // Sync speed changes
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.setSpeed(replaySpeed);
        }
    }, [replaySpeed]);

    const play = useCallback(() => {
        engineRef.current?.play();
        setIsPlaying(true);
    }, []);

    const pause = useCallback(() => {
        engineRef.current?.pause();
        setIsPlaying(false);
    }, []);

    const seek = useCallback((timestamp: number) => {
        engineRef.current?.seek(timestamp);
        setCurrentTimestamp(timestamp);
        setProgress(engineRef.current?.progress ?? 0);
    }, []);

    const setSpeed = useCallback((speed: ReplaySpeed) => {
        useTradingStore.getState().setReplaySpeed(speed);
    }, []);

    const onReplayTick = useCallback((callback: (tick: Tick) => void) => {
        tickCallbackRef.current = callback;
    }, []);

    return {
        play,
        pause,
        seek,
        setSpeed,
        isPlaying,
        progress,
        currentTimestamp,
        isLoading,
        onReplayTick,
    };
}
