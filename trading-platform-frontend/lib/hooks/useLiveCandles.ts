'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { MT5TickData } from '@/lib/types/mt5';
import type { Candle, Timeframe } from '@/lib/types/trading';

const TIMEFRAME_MS: Record<Timeframe, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
};

interface AggregatingCandle {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    periodStart: number; // ms
}

/**
 * useLiveCandles — Aggregates MT5 ticks into OHLCV candles in real-time.
 * Calls onCandleUpdate whenever the current candle changes.
 * Calls onCandleClosed when a candle period completes and a new one starts.
 */
export function useLiveCandles(
    symbol: string,
    timeframe: Timeframe,
    onCandleUpdate: (candle: Candle) => void,
    onCandleClosed?: (candle: Candle) => void,
) {
    const activeCandle = useRef<AggregatingCandle | null>(null);
    const onCandleUpdateRef = useRef(onCandleUpdate);
    const onCandleClosedRef = useRef(onCandleClosed);

    useEffect(() => {
        onCandleUpdateRef.current = onCandleUpdate;
        onCandleClosedRef.current = onCandleClosed;
    });

    const processTick = useCallback(
        (tick: MT5TickData) => {
            if (tick.symbol !== symbol) return;

            const intervalMs = TIMEFRAME_MS[timeframe] || 300_000;
            const tickTime = typeof tick.time === 'string' ? new Date(tick.time).getTime() : tick.time;
            const periodStart = Math.floor(tickTime / intervalMs) * intervalMs;
            const price = tick.last || (tick.bid + tick.ask) / 2;
            const volume = tick.volume || 1;

            const existing = activeCandle.current;

            if (existing && existing.periodStart === periodStart) {
                // Update existing candle
                existing.high = Math.max(existing.high, price);
                existing.low = Math.min(existing.low, price);
                existing.close = price;
                existing.volume += volume;

                onCandleUpdateRef.current({
                    time: Math.floor(periodStart / 1000),
                    open: existing.open,
                    high: existing.high,
                    low: existing.low,
                    close: existing.close,
                    volume: existing.volume,
                });
            } else {
                // Close previous candle
                if (existing) {
                    onCandleClosedRef.current?.({
                        time: Math.floor(existing.periodStart / 1000),
                        open: existing.open,
                        high: existing.high,
                        low: existing.low,
                        close: existing.close,
                        volume: existing.volume,
                    });
                }

                // Start new candle
                const newCandle: AggregatingCandle = {
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume,
                    periodStart,
                };
                activeCandle.current = newCandle;

                onCandleUpdateRef.current({
                    time: Math.floor(periodStart / 1000),
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    volume,
                });
            }
        },
        [symbol, timeframe],
    );

    // Reset when symbol or timeframe changes
    useEffect(() => {
        activeCandle.current = null;
    }, [symbol, timeframe]);

    return { processTick };
}
