'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CandleChart from './CandleChart';
import TradingViewWidget from './TradingViewWidget';
import { useTradingStore } from '@/lib/stores/tradingStore';
import { useMT5 } from '@/components/mt5/MT5Context';
import { useLiveCandles } from '@/lib/hooks/useLiveCandles';
import type { Timeframe, Candle } from '@/lib/types/trading';

interface ChartConfig {
    symbol: string;
    timeframe: Timeframe;
}

interface ChartGridProps {
    mode: '1x1' | '2x2';
    chartProvider: 'native' | 'tradingview';
    /** Ref callback — exposes the main chart's series + container refs for drawing tools */
    onChartReady?: (refs: { chart: any; series: any; container: HTMLDivElement }) => void;
    /** Fires with the clicked price (from subscribeClick) */
    onChartClick?: (price: number, time?: number) => void;
    /** When true, sets crosshair cursor on the chart canvas */
    drawingMode?: boolean;
}

const DEFAULT_CONFIGS: ChartConfig[] = [
    { symbol: 'EURUSD', timeframe: '5m' },
    { symbol: 'GBPUSD', timeframe: '5m' },
    { symbol: 'USDJPY', timeframe: '15m' },
    { symbol: 'XAUUSD', timeframe: '1h' },
];

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

export default function ChartGrid({
    mode,
    chartProvider,
    onChartReady,
    onChartClick,
    drawingMode,
}: ChartGridProps) {
    const { activeSymbol, timeframe, replayActive, markers, tradeArrows } = useTradingStore();
    const [gridConfigs, setGridConfigs] = useState<ChartConfig[]>(DEFAULT_CONFIGS);
    const [focusedChart, setFocusedChart] = useState(0);

    const updateGridConfig = useCallback((index: number, updates: Partial<ChartConfig>) => {
        setGridConfigs((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...updates };
            return next;
        });
    }, []);

    if (mode === '1x1') {
        return (
            <motion.div
                layout
                className="h-full w-full relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                {chartProvider === 'tradingview' ? (
                    <TradingViewWidget symbol={activeSymbol} timeframe={timeframe} chartId="main-chart" />
                ) : (
                    <LiveChartCell
                        symbol={activeSymbol}
                        timeframe={timeframe}
                        chartId="main-chart"
                        height={600}
                        isFocused
                        markers={markers}
                        tradeArrows={tradeArrows}
                        onChartReady={onChartReady}
                        onChartClick={onChartClick}
                        drawingMode={drawingMode}
                    />
                )}
            </motion.div>
        );
    }

    return (
        <motion.div
            layout
            className="h-full w-full grid grid-cols-2 grid-rows-2 gap-px bg-muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <AnimatePresence mode="wait">
                {gridConfigs.slice(0, 4).map((config, index) => (
                    <motion.div
                        key={`chart-${index}`}
                        layout
                        className="relative bg-background overflow-hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setFocusedChart(index)}
                    >
                        {/* Mini toolbar */}
                        <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-1 px-2 py-1 bg-background/90 border-b border-border">
                            <select
                                value={config.symbol}
                                onChange={(e) => updateGridConfig(index, { symbol: e.target.value })}
                                className="bg-transparent text-[10px] text-foreground/70 font-mono border-none outline-none cursor-pointer"
                            >
                                {['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'US500', 'NAS100', 'EURGBP'].map((s) => (
                                    <option key={s} value={s} className="bg-background">{s}</option>
                                ))}
                            </select>

                            <div className="flex gap-0.5 ml-1">
                                {TIMEFRAMES.map((tf) => (
                                    <button
                                        key={tf}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateGridConfig(index, { timeframe: tf });
                                        }}
                                        className={`px-1.5 py-0.5 text-[9px] font-mono rounded transition-colors ${config.timeframe === tf
                                            ? 'bg-indigo-500/30 text-indigo-300'
                                            : 'text-muted-foreground hover:text-foreground/60'
                                            }`}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>

                            {focusedChart === index && (
                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                            )}
                        </div>

                        <div className="pt-6 h-full">
                            {chartProvider === 'tradingview' ? (
                                <TradingViewWidget
                                    symbol={config.symbol}
                                    timeframe={config.timeframe}
                                    chartId={`grid-chart-${index}`}
                                />
                            ) : (
                                <LiveChartCell
                                    symbol={config.symbol}
                                    timeframe={config.timeframe}
                                    chartId={`grid-chart-${index}`}
                                    height={300}
                                    isFocused={focusedChart === index}
                                />
                            )}
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </motion.div>
    );
}

/**
 * LiveChartCell — Each cell subscribes to MT5 ticks for its symbol,
 * aggregates them into candles, and pushes updates to CandleChart.
 */
function LiveChartCell({
    symbol,
    timeframe,
    chartId,
    height,
    isFocused,
    markers,
    tradeArrows,
    onChartReady,
    onChartClick,
    drawingMode,
}: {
    symbol: string;
    timeframe: Timeframe;
    chartId: string;
    height: number;
    isFocused: boolean;
    markers?: any[];
    tradeArrows?: any[];
    onChartReady?: (refs: { chart: any; series: any; container: HTMLDivElement }) => void;
    onChartClick?: (price: number, time?: number) => void;
    drawingMode?: boolean;
}) {
    const mt5 = useMT5();

    // Ref to the CandleChart's update function
    const candleUpdateFnRef = useRef<((candle: Candle) => void) | null>(null);

    // Register the CandleChart callback
    const registerCandleHandler = useCallback((fn: (candle: Candle) => void) => {
        candleUpdateFnRef.current = fn;
    }, []);

    // Aggregate MT5 ticks into candles
    const { processTick } = useLiveCandles(
        symbol,
        timeframe,
        // onCandleUpdate — forward to CandleChart
        useCallback((candle: Candle) => {
            candleUpdateFnRef.current?.(candle);
        }, []),
    );

    // Subscribe to this cell's symbol on MT5
    useEffect(() => {
        mt5.subscribe(symbol);
        return () => {
            mt5.unsubscribe(symbol);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol]);

    // Use callback-based tick delivery for real-time updates
    const processTickRef = useRef(processTick);
    processTickRef.current = processTick;

    useEffect(() => {
        const handler = (tick: import('@/lib/types/mt5').MT5TickData) => {
            processTickRef.current(tick);
        };
        mt5.onTick(symbol, handler);
        return () => {
            mt5.offTick(symbol, handler);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol]);

    return (
        <CandleChart
            symbol={symbol}
            timeframe={timeframe}
            chartId={chartId}
            height={height}
            onCandleUpdate={registerCandleHandler}
            markers={markers}
            tradeArrows={tradeArrows}
            isFocused={isFocused}
            onChartReady={onChartReady}
            onChartClick={onChartClick}
            drawingMode={drawingMode}
        />
    );
}
