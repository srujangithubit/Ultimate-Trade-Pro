import { useEffect, useRef, useCallback, RefObject } from 'react';
import {
    createChart,
    ColorType,
    CrosshairMode,
    ISeriesApi,
    UTCTimestamp,
    CandlestickData,
    HistogramData,
    SeriesMarker,
    CandlestickSeries,
    HistogramSeries,
    createSeriesMarkers,
} from 'lightweight-charts';
import { BacktestCandle, BacktestTrade } from '../types/backtesting';

const CHART_THEMES = {
    dark: {
        background: '#0a0a0f',
        textColor: '#a0a0b0',
        gridColor: '#1a1a2e',
        borderColor: '#2a2a3e',
    },
    light: {
        background: '#ffffff',
        textColor: '#333340',
        gridColor: '#e8e8f0',
        borderColor: '#d0d0dd',
    },
};

export function useBacktestChart(containerRef: RefObject<HTMLDivElement | null>, theme?: string) {
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const markersRef = useRef<SeriesMarker<UTCTimestamp>[]>([]);
    const seriesMarkersRef = useRef<ReturnType<typeof createSeriesMarkers> | null>(null);
    const seededRef = useRef(false);
    const lastCandleTimeRef = useRef(0);
    const chartClickRef = useRef<((price: number, time?: number) => void) | null>(null);
    /** True after chart.remove() — guards all series/chart operations */
    const disposedRef = useRef(false);

    // Initialize chart on mount
    useEffect(() => {
        if (!containerRef.current) return;

        const colors = CHART_THEMES[theme === 'light' ? 'light' : 'dark'];

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: colors.background },
                textColor: colors.textColor,
            },
            grid: {
                vertLines: { color: colors.gridColor },
                horzLines: { color: colors.gridColor },
            },
            crosshair: { mode: CrosshairMode.Normal },
            timeScale: {
                borderColor: colors.borderColor,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 12,
            },
            rightPriceScale: { borderColor: colors.borderColor },
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
        });

        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#00d4aa',
            downColor: '#ff4444',
            borderUpColor: '#00d4aa',
            borderDownColor: '#ff4444',
            wickUpColor: '#00d4aa',
            wickDownColor: '#ff4444',
        });

        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });

        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        disposedRef.current = false;
        chartRef.current = chart;
        candleSeriesRef.current = candleSeries;
        volumeSeriesRef.current = volumeSeries;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        seriesMarkersRef.current = createSeriesMarkers(candleSeries) as any;

        // Chart click handler — converts Y pixel to price via series (for drawing tools)
        chart.subscribeClick((param) => {
            if (param.point && candleSeriesRef.current) {
                const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
                if (typeof price === 'number' && isFinite(price) && !isNaN(price)) {
                    let time: number | undefined;
                    if (typeof param.time === 'number') {
                        time = param.time;
                    } else {
                        // Fallback: derive time from x-coordinate when clicking between/beyond candles
                        const rawTime = (chart.timeScale() as unknown as { coordinateToTime(x: number): unknown | null })
                            .coordinateToTime(param.point.x);
                        if (typeof rawTime === 'number') {
                            time = rawTime;
                        } else {
                            // Extrapolate time for positions beyond candle data range
                            const ts = chart.timeScale() as unknown as { timeToCoordinate(t: unknown): number | null };
                            const data = (candleSeriesRef.current as unknown as { data(): { time: number }[] }).data?.();
                            if (data && data.length >= 2) {
                                const last = data[data.length - 1];
                                const prev = data[data.length - 2];
                                const barInterval = last.time - prev.time;
                                if (barInterval > 0) {
                                    const lastX = ts.timeToCoordinate(last.time);
                                    const prevX = ts.timeToCoordinate(prev.time);
                                    if (lastX != null && prevX != null) {
                                        const pxPerBar = (lastX as number) - (prevX as number);
                                        if (pxPerBar !== 0) {
                                            const barsOffset = (param.point.x - (lastX as number)) / pxPerBar;
                                            time = last.time + barsOffset * barInterval;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    chartClickRef.current?.(price, time);
                }
            }
        });

        const ro = new ResizeObserver(() => {
            if (containerRef.current && !disposedRef.current) {
                chart.applyOptions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        });
        ro.observe(containerRef.current);

        return () => {
            disposedRef.current = true;
            ro.disconnect();
            // Detach markers plugin BEFORE removing the chart —
            // chart.remove() disposes all series, so detach() after
            // would hit an already-disposed series ("Object is disposed").
            if (seriesMarkersRef.current) {
                try { seriesMarkersRef.current.detach(); } catch { /* already detached */ }
                seriesMarkersRef.current = null;
            }
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
            seededRef.current = false;
        };
    }, []); // empty deps — chart lives for component lifetime

    // Update chart colors when theme changes
    useEffect(() => {
        if (!chartRef.current || disposedRef.current) return;
        const colors = CHART_THEMES[theme === 'light' ? 'light' : 'dark'];
        chartRef.current.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: colors.background },
                textColor: colors.textColor,
            },
            grid: {
                vertLines: { color: colors.gridColor },
                horzLines: { color: colors.gridColor },
            },
            timeScale: { borderColor: colors.borderColor },
            rightPriceScale: { borderColor: colors.borderColor },
        });
    }, [theme]);

    // Seed chart with historical candles (called once when initial data arrives)
    const seedChart = useCallback((candles: BacktestCandle[]) => {
        if (disposedRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) {
            console.warn('[useBacktestChart] seedChart called but series not initialized or disposed');
            return;
        }
        if (!candles || candles.length === 0) {
            console.warn('[useBacktestChart] seedChart called with 0 candles');
            return;
        }

        console.log(`[useBacktestChart] seedChart: ${candles.length} raw candles, first.time=${candles[0]?.time}`);

        // Validate and deduplicate candles
        const MIN_TS = 946684800;   // 2000-01-01
        const MAX_TS = 4102444800;  // 2100-01-01
        const seen = new Set<number>();
        let rejected = 0;
        const validCandles = candles.filter(c => {
            if (!c.time || c.time <= 0) { rejected++; return false; }
            if (c.time < MIN_TS || c.time > MAX_TS) { rejected++; return false; }
            if (isNaN(c.open) || isNaN(c.high) || isNaN(c.low) || isNaN(c.close)) { rejected++; return false; }
            if (seen.has(c.time)) { rejected++; return false; }
            seen.add(c.time);
            return true;
        });

        if (rejected > 0) {
            console.warn(`[useBacktestChart] seedChart: rejected ${rejected} invalid candles`);
        }

        if (validCandles.length === 0) {
            console.error('[useBacktestChart] seedChart: ALL candles failed validation!');
            return;
        }

        // Sort by time ASC — Lightweight Charts requires sorted data
        validCandles.sort((a, b) => a.time - b.time);

        const candleData: CandlestickData[] = validCandles.map(c => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        const volumeData: HistogramData[] = validCandles.map(c => ({
            time: c.time as UTCTimestamp,
            value: c.volume,
            color: c.close >= c.open ? '#00d4aa33' : '#ff444433',
        }));

        try {
            candleSeriesRef.current.setData(candleData);
            volumeSeriesRef.current.setData(volumeData);
        } catch (err) {
            console.warn('[useBacktestChart] seedChart setData error (chart may be disposed):', err);
            return;
        }

        seededRef.current = true;
        if (validCandles.length > 0) {
            lastCandleTimeRef.current = validCandles[validCandles.length - 1].time;
        }

        // Scroll to latest candle and enable real-time tracking for subsequent update() calls
        try { chartRef.current?.timeScale().scrollToRealTime(); } catch { /* disposed */ }

        // Re-apply any existing markers after setData so they stay visible
        if (markersRef.current.length > 0 && seriesMarkersRef.current) {
            try { seriesMarkersRef.current.setMarkers(markersRef.current); } catch { /* disposed */ }
        }
    }, []);

    // Mark chart ready to receive candles (no data yet — first updateCandle
    // call will seed the first point via setData, subsequent ones use update).
    const initChart = useCallback(() => {
        if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
        // Don't call setData([]) — Lightweight Charts can't update() on an
        // empty series.  Instead just flip the flag; updateCandle handles the
        // first-candle bootstrap via setData([first]).
        seededRef.current = true;
        lastCandleTimeRef.current = 0;
        console.log('[useBacktestChart] initChart: chart ready (waiting for first candle)');
    }, []);

    // Append/update a single candle from the replay stream.
    // If the series has no data yet (lastCandleTimeRef === 0), we bootstrap it
    // with setData so Lightweight Charts has a valid first point.
    const updateCandle = useCallback((candle: BacktestCandle) => {
        if (disposedRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
        if (!seededRef.current) return; // must init/seed first
        const t = Number(candle.time);
        if (!t || t <= 0) return; // reject invalid

        const candlePoint: CandlestickData = {
            time: t as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
        };

        const volumePoint: HistogramData = {
            time: t as UTCTimestamp,
            value: candle.volume,
            color: candle.close >= candle.open ? '#00d4aa33' : '#ff444433',
        };

        try {
            if (lastCandleTimeRef.current === 0) {
                // First candle — bootstrap the series with setData
                candleSeriesRef.current.setData([candlePoint]);
                volumeSeriesRef.current.setData([volumePoint]);
                chartRef.current?.timeScale().scrollToRealTime();
            } else if (t >= lastCandleTimeRef.current) {
                // New candle or update to the current bar
                candleSeriesRef.current.update(candlePoint);
                volumeSeriesRef.current.update(volumePoint);
            } else {
                // Engine is behind the chart (catching up) — skip silently
                return;
            }
            if (t >= lastCandleTimeRef.current) {
                lastCandleTimeRef.current = t;
            }
        } catch (err) {
            console.warn('[useBacktestChart] updateCandle error:', t, 'last:', lastCandleTimeRef.current, err);
        }
    }, []);

    // Seek: rebuild chart up to a specific index (used when user drags timeline slider)
    const seekToCandles = useCallback((candles: BacktestCandle[], upToIndex: number) => {
        if (disposedRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
        const slice = candles.slice(0, upToIndex + 1);
        seededRef.current = false; // reset so seedChart validates properly
        seedChart(slice);
    }, [seedChart]);

    const addTradeMarker = useCallback((trade: BacktestTrade, type: 'entry' | 'exit', timeOffset = 0) => {
        if (disposedRef.current || !candleSeriesRef.current) return;
        const existing = markersRef.current;

        // Compute marker timestamp.
        // Callers pass either:
        //   a) a pre-computed IST-shifted number (timeRef.current) + timeOffset=0
        //   b) an ISO string or raw unix seconds + timeOffset=IST_DISPLAY_OFFSET
        const rawVal = type === 'entry' ? trade.entryTime : trade.exitTime!;
        let markerSec: number;
        if (typeof rawVal === 'number') {
            markerSec = rawVal + timeOffset;
        } else {
            const parsed = Math.floor(new Date(rawVal).getTime() / 1000);
            markerSec = (isNaN(parsed) ? lastCandleTimeRef.current : parsed) + timeOffset;
        }
        // Fallback: if marker time is 0 or invalid, use the last known candle time
        if (!markerSec || markerSec <= 0) {
            markerSec = lastCandleTimeRef.current;
        }
        const markerTime = markerSec as UTCTimestamp;

        const marker: SeriesMarker<UTCTimestamp> = {
            time: markerTime,
            position: trade.side === 'buy' ? 'belowBar' : 'aboveBar',
            color: type === 'entry'
                ? (trade.side === 'buy' ? '#00d4aa' : '#ff4444')
                : '#888888',
            shape: type === 'entry'
                ? (trade.side === 'buy' ? 'arrowUp' : 'arrowDown')
                : 'circle',
            text: type === 'entry'
                ? (trade.side === 'buy' ? `B ${trade.volume}` : `S ${trade.volume}`)
                : `Exit ${trade.pnlNet >= 0 ? '+' : ''}$${trade.pnlNet.toFixed(2)}`,
            id: `${trade.id}-${type}`,
        };

        // Remove any existing marker with the same id (prevent duplicates)
        const filtered = existing.filter(m => m.id !== marker.id);
        const newMarkers = [...filtered, marker].sort((a, b) => (a.time as number) - (b.time as number));
        markersRef.current = newMarkers;
        seriesMarkersRef.current?.setMarkers(newMarkers);
    }, []);

    const clearMarkers = useCallback(() => {
        markersRef.current = [];
        seriesMarkersRef.current?.setMarkers([]);
    }, []);

    /** Register a click handler for chart drawing tools */
    const registerChartClick = useCallback((fn: ((price: number, time?: number) => void) | null) => {
        chartClickRef.current = fn;
    }, []);

    return {
        initChart,
        seedChart,
        updateCandle,
        seekToCandles,
        addTradeMarker,
        clearMarkers,
        chartReady: !!chartRef.current,
        /** Expose chart instance for drawing tools (crosshair mode, etc.) */
        chartInstance: chartRef,
        /** Expose candle series for price-line drawing tools */
        candleSeries: candleSeriesRef,
        /** Register a click handler that fires with price when user clicks on the chart */
        registerChartClick,
    };
}
