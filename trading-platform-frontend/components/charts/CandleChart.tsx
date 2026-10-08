'use client';

import { useRef, useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
    createChart,
    CandlestickSeries,
    HistogramSeries,
    type IChartApi,
    type ISeriesApi,
    type UTCTimestamp
} from 'lightweight-charts';
import { useTradingStore } from '@/lib/stores/tradingStore';
import type { Candle, Timeframe, SignalMarker, TradeArrow } from '@/lib/types/trading';

// Map frontend timeframes to MT5 format
const TF_TO_MT5: Record<Timeframe, string> = {
    '1m': 'M1',
    '5m': 'M5',
    '15m': 'M15',
    '1h': 'H1',
};

const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '1h': 3600,
};

// Theme palettes for Lightweight Charts
const CHART_THEMES = {
    dark: {
        background: '#0a0a0f',
        textColor: '#a0a0b0',
        gridColor: '#1a1a2e',
        borderColor: '#1a1a2e',
        crosshairColor: 'rgba(255, 255, 255, 0.15)',
        crosshairLabelBg: '#1e1e3a',
    },
    light: {
        background: '#ffffff',
        textColor: '#333340',
        gridColor: '#e5e5e5',
        borderColor: '#d0d0d8',
        crosshairColor: 'rgba(0, 0, 0, 0.15)',
        crosshairLabelBg: '#f0f0f5',
    },
};

// MT5 Node server URL (port 3001)
const MT5_API_URL = process.env.NEXT_PUBLIC_MT5_API_URL || 'http://localhost:3001';
// Backend API URL (port 3000) — serves candles from DB
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const MT5_INTERNAL_API_KEY = process.env.NEXT_PUBLIC_MT5_INTERNAL_API_KEY || '';

function getMt5RequestHeaders(): HeadersInit {
    const key = MT5_INTERNAL_API_KEY
        || (typeof window !== 'undefined'
            ? window.localStorage.getItem('mt5_internal_api_key') || ''
            : '');

    return key ? { Authorization: `Bearer ${key}` } : {};
}

interface CandleChartProps {
    symbol: string;
    timeframe: Timeframe;
    chartId: string;
    height: number;
    onCandleUpdate?: (registerFn: (candle: Candle) => void) => void;
    markers?: SignalMarker[];
    tradeArrows?: TradeArrow[];
    isFocused?: boolean;
    /** Callback that fires after chart is created — exposes chart + series + container refs for drawing tools */
    onChartReady?: (refs: { chart: IChartApi; series: ISeriesApi<'Candlestick'>; container: HTMLDivElement }) => void;
    /** Fires with the clicked price and time when user clicks on the chart (for drawing tools) */
    onChartClick?: (price: number, time?: number) => void;
    /** When true, shows crosshair cursor over the chart */
    drawingMode?: boolean;
}

export default function CandleChart({
    symbol,
    timeframe,
    chartId,
    height,
    onCandleUpdate,
    markers,
    tradeArrows,
    isFocused = true,
    onChartReady,
    onChartClick,
    drawingMode,
}: CandleChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const historicalLatestTimeRef = useRef(0);
    const latestLiveCandleRef = useRef<Candle | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { resolvedTheme } = useTheme();

    const setCrosshairTime = useTradingStore((s) => s.setCrosshairTime);
    const positions = useTradingStore((s) => s.positions);

    // Keep a ref to onCandleUpdate so the chart init effect can use the latest callback
    const onCandleUpdateRef = useRef(onCandleUpdate);
    useEffect(() => { onCandleUpdateRef.current = onCandleUpdate; });

    // Keep a ref to onChartClick so subscribeClick always has the latest handler
    const onChartClickRef = useRef(onChartClick);
    useEffect(() => { onChartClickRef.current = onChartClick; });

    // Keep a ref to the theme so chart creation reads it without depending on it
    const themeRef = useRef(resolvedTheme);
    useEffect(() => { themeRef.current = resolvedTheme; }, [resolvedTheme]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Initialize chart — created once, NOT destroyed on theme change.
    // Theme updates are handled by the applyOptions effect below.
    useEffect(() => {
        if (!containerRef.current || !mounted) return;

        const palette = CHART_THEMES[themeRef.current === 'light' ? 'light' : 'dark'];

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height,
            layout: {
                background: { color: palette.background },
                textColor: palette.textColor,
                fontSize: 11,
            },
            grid: {
                vertLines: { color: palette.gridColor },
                horzLines: { color: palette.gridColor },
            },
            crosshair: {
                mode: 0,
                vertLine: {
                    color: palette.crosshairColor,
                    labelBackgroundColor: palette.crosshairLabelBg,
                },
                horzLine: {
                    color: palette.crosshairColor,
                    labelBackgroundColor: palette.crosshairLabelBg,
                },
            },
            rightPriceScale: {
                borderColor: palette.borderColor,
                scaleMargins: { top: 0.05, bottom: 0.25 },
            },
            timeScale: {
                borderColor: palette.borderColor,
                timeVisible: true,
                secondsVisible: false,
            },
        });

        chartRef.current = chart;

        // Candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#00d4aa',
            downColor: '#ff4444',
            borderVisible: false,
            wickUpColor: '#00d4aa',
            wickDownColor: '#ff4444',
        });
        candleSeriesRef.current = candleSeries;

        // Volume histogram
        const volumeSeries = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;

        // Crosshair sync
        chart.subscribeCrosshairMove((param) => {
            if (param.time) setCrosshairTime(param.time as number);
        });

        // Chart click handler — converts Y pixel to price via series
        chart.subscribeClick((param) => {
            if (param.point && candleSeriesRef.current) {
                const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
                const time = param.time as number | undefined;
                if (typeof price === 'number' && isFinite(price) && !isNaN(price)) {
                    onChartClickRef.current?.(price, time);
                }
            }
        });

        // Register live candle update handler immediately after chart creation
        if (onCandleUpdateRef.current) {
            onCandleUpdateRef.current((candle: Candle) => {
                const timeframeSeconds = TIMEFRAME_SECONDS[timeframe] || 300;
                const historyIsStale = historicalLatestTimeRef.current > 0
                    && candle.time > historicalLatestTimeRef.current + timeframeSeconds * 2;

                if (historyIsStale) {
                    candleSeriesRef.current?.setData([]);
                    volumeSeriesRef.current?.setData([]);
                    historicalLatestTimeRef.current = 0;
                }

                latestLiveCandleRef.current = candle;
                candleSeriesRef.current?.update({
                    time: candle.time as UTCTimestamp,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                });

                volumeSeriesRef.current?.update({
                    time: candle.time as UTCTimestamp,
                    value: candle.volume,
                    color: candle.close >= candle.open ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 68, 68, 0.2)',
                });

                // Keep the view scrolled to the latest candle
                chartRef.current?.timeScale().scrollToRealTime();
            });
        }

        // Notify parent that chart + series + container are ready (for drawing tools)
        if (onChartReady) {
            onChartReady({ chart, series: candleSeries, container: containerRef.current! });
        }

        // Resize observer
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const cr = entry.contentRect;
                chart.applyOptions({ width: cr.width, height: cr.height });
            }
        });
        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            candleSeriesRef.current = null;
            volumeSeriesRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted, height, setCrosshairTime]);

    // React to theme changes — update appearance without recreating the chart
    useEffect(() => {
        if (!chartRef.current) return;
        const palette = CHART_THEMES[resolvedTheme === 'light' ? 'light' : 'dark'];
        chartRef.current.applyOptions({
            layout: {
                background: { color: palette.background },
                textColor: palette.textColor,
            },
            grid: {
                vertLines: { color: palette.gridColor },
                horzLines: { color: palette.gridColor },
            },
            crosshair: {
                vertLine: {
                    color: palette.crosshairColor,
                    labelBackgroundColor: palette.crosshairLabelBg,
                },
                horzLine: {
                    color: palette.crosshairColor,
                    labelBackgroundColor: palette.crosshairLabelBg,
                },
            },
            rightPriceScale: { borderColor: palette.borderColor },
            timeScale: { borderColor: palette.borderColor },
        });
    }, [resolvedTheme]);

    // Fetch OHLCV data — try MT5 live server first, fallback to backend DB for historical
    useEffect(() => {
        if (!candleSeriesRef.current || !mounted) return;

        let cancelled = false;
        setIsLoading(true);

        const mt5Timeframe = TF_TO_MT5[timeframe] || 'M5';

        // Helper: process raw candles into chart data
        const processCandles = (rawCandles: Array<{
            time: string | number;
            open: number;
            high: number;
            low: number;
            close: number;
            tick_volume: number;
        }>) => {
            if (cancelled || !candleSeriesRef.current) return;

            if (rawCandles.length === 0) {
                console.warn(`[CandleChart] No OHLCV data for ${symbol} ${mt5Timeframe}`);
                setIsLoading(false);
                return;
            }

            // MT5 returns rates newest-first. Lightweight Charts requires
            // strictly ascending, unique timestamps.
            const candlesByTime = new Map<number, {
                time: UTCTimestamp;
                open: number;
                high: number;
                low: number;
                close: number;
                volume: number;
            }>();

            for (const candle of rawCandles) {
                const rawTime = typeof candle.time === 'number'
                    ? candle.time
                    : new Date(candle.time).getTime();
                const time = Math.floor((rawTime > 10_000_000_000 ? rawTime : rawTime * 1000) / 1000);

                if (
                    !Number.isFinite(time) ||
                    !Number.isFinite(candle.open) ||
                    !Number.isFinite(candle.high) ||
                    !Number.isFinite(candle.low) ||
                    !Number.isFinite(candle.close)
                ) {
                    continue;
                }

                candlesByTime.set(time, {
                    time: time as UTCTimestamp,
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: Number.isFinite(candle.tick_volume) ? candle.tick_volume : 0,
                });
            }

            const candleData = [...candlesByTime.values()].sort((a, b) => a.time - b.time);

            if (candleData.length === 0) {
                console.warn(`[CandleChart] No valid OHLCV data for ${symbol} ${mt5Timeframe}`);
                setIsLoading(false);
                return;
            }

            const volumeData = candleData.map((c) => ({
                time: c.time,
                value: c.volume,
                color: c.close >= c.open ? 'rgba(0, 212, 170, 0.2)' : 'rgba(255, 68, 68, 0.2)',
            }));

            const latestHistoricalTime = candleData[candleData.length - 1].time as number;
            const latestLiveCandle = latestLiveCandleRef.current;
            const historyIsStale = latestLiveCandle
                && latestLiveCandle.time > latestHistoricalTime + (TIMEFRAME_SECONDS[timeframe] || 300) * 2;

            if (historyIsStale) {
                // Do not mix an old database/terminal snapshot with current
                // ticks; the live candle is the authoritative current series.
                candleSeriesRef.current!.setData([]);
                volumeSeriesRef.current?.setData([]);
                candleSeriesRef.current!.update({
                    time: latestLiveCandle.time as UTCTimestamp,
                    open: latestLiveCandle.open,
                    high: latestLiveCandle.high,
                    low: latestLiveCandle.low,
                    close: latestLiveCandle.close,
                });
                volumeSeriesRef.current?.update({
                    time: latestLiveCandle.time as UTCTimestamp,
                    value: latestLiveCandle.volume,
                    color: latestLiveCandle.close >= latestLiveCandle.open
                        ? 'rgba(0, 212, 170, 0.2)'
                        : 'rgba(255, 68, 68, 0.2)',
                });
                historicalLatestTimeRef.current = 0;
            } else {
                candleSeriesRef.current!.setData(candleData);
                volumeSeriesRef.current?.setData(volumeData);
                historicalLatestTimeRef.current = latestHistoricalTime;
            }
            chartRef.current?.timeScale().scrollToRealTime();
            setIsLoading(false);
        };

        // Primary: MT5 live server (real-time, freshest data)
        fetch(`${MT5_API_URL}/api/mt5/ohlcv?symbol=${symbol}&timeframe=${mt5Timeframe}&bars=300`, {
            headers: getMt5RequestHeaders(),
        })
            .then((res) => {
                if (!res.ok) throw new Error(`MT5 HTTP ${res.status}`);
                return res.json();
            })
            .then((result) => {
                const rawCandles = result.data || [];
                if (rawCandles.length > 0) {
                    console.log(`[CandleChart] Loaded ${rawCandles.length} candles from MT5 for ${symbol} ${mt5Timeframe}`);
                    processCandles(rawCandles);
                } else {
                    throw new Error('No data from MT5');
                }
            })
            .catch((mt5Err) => {
                // Fallback: backend DB (14M+ historical candles)
                console.warn(`[CandleChart] MT5 server unavailable (${mt5Err.message}), loading from DB...`);
                return fetch(`${BACKEND_API_URL}/market-data/candles?symbol=${symbol}&timeframe=${mt5Timeframe}&bars=300`)
                    .then((res) => {
                        if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);
                        return res.json();
                    })
                    .then((result) => {
                        const rawCandles = result.data || [];
                        console.log(`[CandleChart] Loaded ${rawCandles.length} candles from DB for ${symbol} ${mt5Timeframe}`);
                        processCandles(rawCandles);
                    });
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error(`[CandleChart] Failed to load OHLCV from both sources:`, err);
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [symbol, timeframe, mounted]);

    // Signal markers and trade arrows
    useEffect(() => {
        if (!candleSeriesRef.current) return;

        const combined: Array<{
            time: number;
            position: 'aboveBar' | 'belowBar';
            color: string;
            shape: 'arrowUp' | 'arrowDown' | 'circle' | 'square';
            text: string;
        }> = [];

        if (markers) {
            for (const m of markers) {
                combined.push({ time: m.time, position: m.position, color: m.color, shape: m.shape, text: m.text });
            }
        }
        if (tradeArrows) {
            for (const a of tradeArrows) {
                combined.push({
                    time: a.time,
                    position: a.side === 'buy' ? 'belowBar' : 'aboveBar',
                    color: a.side === 'buy' ? '#00d4aa' : '#ff4444',
                    shape: a.side === 'buy' ? 'arrowUp' : 'arrowDown',
                    text: a.label,
                });
            }
        }

        combined.sort((a, b) => a.time - b.time);
        (candleSeriesRef.current as any).setMarkers(combined);
    }, [markers, tradeArrows]);

    // SL/TP lines for open positions
    useEffect(() => {
        if (!candleSeriesRef.current) return;

        const openPositions = positions.filter(
            (p) => p.symbol === symbol && p.closedAt === null
        );

        for (const pos of openPositions) {
            if (pos.sl !== null) {
                candleSeriesRef.current.createPriceLine({
                    price: pos.sl, color: '#ff4444', lineWidth: 1, lineStyle: 2,
                    axisLabelVisible: true, title: `SL ${pos.id.slice(0, 4)}`,
                });
            }
            if (pos.tp !== null) {
                candleSeriesRef.current.createPriceLine({
                    price: pos.tp, color: '#00d4aa', lineWidth: 1, lineStyle: 2,
                    axisLabelVisible: true, title: `TP ${pos.id.slice(0, 4)}`,
                });
            }
        }
    }, [positions, symbol]);

    return (
        <div className="relative h-full w-full" style={{ minHeight: height }}>
            {/* Symbol label overlay */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
                <span className="text-sm font-bold text-foreground/80 tracking-wide">{symbol}</span>
                <span className="text-xs text-muted-foreground font-mono">• {timeframe}</span>
                {isFocused && (
                    <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
            </div>

            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80">
                    <div className="flex items-center gap-3">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
                        <span className="text-xs text-muted-foreground font-mono">Loading {symbol} candles...</span>
                    </div>
                </div>
            )}

            {/* Chart container */}
            <div
                ref={containerRef}
                className={`h-full w-full ${drawingMode ? '**:cursor-crosshair!' : ''}`}
            />

            {/* Floating PnL labels */}
            {positions
                .filter((p) => p.symbol === symbol && p.closedAt === null)
                .map((pos) => (
                    <div
                        key={pos.id}
                        className="absolute right-16 z-10 pointer-events-none"
                        style={{ top: '30%', transform: 'translateY(-50%)' }}
                    >
                        <div
                            className={`rounded px-2 py-0.5 text-xs font-mono font-semibold ${pos.pnl >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                }`}
                        >
                            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                        </div>
                    </div>
                ))}
        </div>
    );
}
