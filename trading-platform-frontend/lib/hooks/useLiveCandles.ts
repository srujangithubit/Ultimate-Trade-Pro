'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { MT5TickData } from '@/lib/types/mt5';
import type { Candle, Timeframe } from '@/lib/types/trading';

const TIMEFRAME_MS: Record<Timeframe, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
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
            const rawTickTime = typeof tick.time === 'string'
                ? Date.parse(/Z$|[+-]\d{2}:?\d{2}$/.test(tick.time) ? tick.time : `${tick.time}Z`)
                : tick.time;
            const tickTime = rawTickTime > 10_000_000_000
                ? rawTickTime
                : rawTickTime * 1000;
            if (!Number.isFinite(tickTime)) return;

            const periodStart = Math.floor(tickTime / intervalMs) * intervalMs;
            const bid = Number(tick.bid);
            const ask = Number(tick.ask);
            const last = Number(tick.last);
            const price = Number.isFinite(last) && last > 0
                ? last
                : (bid + ask) / 2;
            const volume = Number(tick.volume);
            if (!Number.isFinite(price) || price <= 0) return;
            const tickVolume = Number.isFinite(volume) && volume > 0 ? volume : 1;

            const existing = activeCandle.current;

            if (existing && existing.periodStart === periodStart) {
                // Update existing candle
                existing.high = Math.max(existing.high, price);
                existing.low = Math.min(existing.low, price);
                existing.close = price;
                existing.volume += tickVolume;

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
                    volume: tickVolume,
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
