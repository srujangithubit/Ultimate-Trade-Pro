'use client';

import { useState, useRef, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Activity, BarChart3, Plus, Minus, X, Clock, ShieldCheck, Radar } from 'lucide-react';
import { useTheme } from 'next-themes';

import api from '@/lib/api/client';
import { useBacktestSocket } from '@/lib/hooks/useBacktestSocket';
import { useBacktestChart } from '@/lib/hooks/useBacktestChart';
import { PlaybackControls } from '@/components/backtesting/PlaybackControls';
import ChartToolbar from '@/components/backtesting/TradingViewToolbar';
import type { IPriceLine } from 'lightweight-charts';
import { useChartDrawings } from '@/lib/hooks/useChartDrawings';
import { SetupValidator } from '@/components/backtesting/SetupValidator';
import { SetupDetector } from '@/components/backtesting/SetupDetector';
import { DrawingLayer } from '@/components/backtesting/DrawingLayer';
import { PriceScaleMenu } from '@/components/backtesting/PriceScaleMenu';
import { DrawingToolbar } from '@/components/backtesting/DrawingToolbar';
import { FibSettingsDialog } from '@/components/backtesting/FibSettingsDialog';
import { DraggableAlertOverlay, OverlayAlert } from '@/components/charts/DraggableAlertOverlay';
import {
    BacktestSession,
    BacktestSessionTrade,
    BacktestCandle,
    BacktestTrade,
    ReplaySpeed,
    CreateOrderDto
} from '@/lib/types/backtesting';

/** Raw candle record from the backend API */
interface RawCandle {
    time: number | string;
    open: number | string;
    high: number | string;
    low: number | string;
    close: number | string;
    volume?: number | string;
}

/** Raw update payload from the backtest WebSocket */
interface RawUpdate {
    candle?: { index?: number; close?: number; time?: number };
    state?: Record<string, unknown>;
    openPositions?: RawPosition[];
    openTrades?: RawPosition[];
    [key: string]: unknown;
}

/** Raw position from the engine */
interface RawPosition {
    id: string;
    side?: string;
    direction?: string;
    volume?: number;
    quantity?: number;
    entryPrice: number | string;
    unrealizedPnL?: number;
    mae?: number;
    mfe?: number;
    [key: string]: unknown;
}

/** Offset (in seconds) to convert stored candle timestamps to IST for display.
 *  Candles are stored in broker time (UTC+2). IST = UTC+5:30.
 *  Difference: 5h30m − 2h = 3h30m = 12 600 seconds. */
const IST_DISPLAY_OFFSET = 12_600;

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;

function isEnginePlaying(status: unknown): boolean {
    if (typeof status !== 'string') return false;
    const normalized = status.toLowerCase();
    return normalized === 'playing' || normalized === 'running';
}

export default function BacktestReplayPage({ params }: { params: Promise<{ sessionId: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const sessionId = resolvedParams.sessionId;
    const { resolvedTheme } = useTheme();

    // Real-time refs for Canvas/DOM driven UI
    const currentPriceRef = useRef<number>(0);
    const balanceRef = useRef<number>(0);
    const equityRef = useRef<number>(0);
    const pnlRef = useRef<number>(0);
    /** Cumulative realized P&L from closed trades — survives engine restarts */
    const realizedPnLRef = useRef<number>(0);
    const progressRef = useRef<number>(0);
    const indexRef = useRef<number>(0);
    const timeRef = useRef<number>(0);
    const isPlayingRef = useRef<boolean>(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const timeframeSwitchingRef = useRef<boolean>(false);

    // Structural React states
    const [openTrades, setOpenTrades] = useState<BacktestTrade[]>([]);
    const [closedTrades, setClosedTrades] = useState<BacktestSessionTrade[]>([]);
    const [replaySpeed, setReplaySpeed] = useState<ReplaySpeed>(1);
    const [activeTimeframe, setActiveTimeframe] = useState<string>(() => '');
    const [activeTab, setActiveTab] = useState<'order' | 'positions' | 'history'>('order');
    const [orderForm, setOrderForm] = useState<{ volume: number, type: 'market' | 'limit' | 'stop', price: string, sl: string, tp: string }>({
        volume: 1, type: 'market', price: '', sl: '', tp: ''
    });
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [orderError, setOrderError] = useState<string | null>(null);
    const [validatorOpen, setValidatorOpen] = useState(false);
    const [detectorOpen, setDetectorOpen] = useState(false);

    // Price line refs for open positions on chart
    const priceLinesRef = useRef<IPriceLine[]>([]);
    const prevTradeLineKeyRef = useRef<string>('');

    // Order form preview price lines (draggable TP/SL on chart)
    const orderTPLineRef = useRef<IPriceLine | null>(null);
    const orderSLLineRef = useRef<IPriceLine | null>(null);
    const orderEntryLineRef = useRef<IPriceLine | null>(null);
    const draggingLineRef = useRef<'tp' | 'sl' | null>(null);

    // Chart
    const chartContainerRef = useRef<HTMLDivElement>(null);

    // DOM Refs for Account Strip
    const domBalanceRef = useRef<HTMLSpanElement>(null);
    const domEquityRef = useRef<HTMLSpanElement>(null);
    const domPnlRef = useRef<HTMLSpanElement>(null);
    const domPriceRef = useRef<HTMLSpanElement>(null);

    const { data: session } = useQuery<BacktestSession>({
        queryKey: ['session', sessionId],
        queryFn: async () => (await api.get(`/backtesting/sessions/${sessionId}`)).data,
    });

    // Set the default timeframe from the session once loaded
    useEffect(() => {
        if (session?.timeframe && !activeTimeframe) {
            setActiveTimeframe(session.timeframe);
        }
    }, [session?.timeframe, activeTimeframe]);

    // Load persisted trades from session REST response on (re)visit
    useEffect(() => {
        if (!session) return;

        // ── Initialize balance / equity / P&L from persisted data ──
        const startBal = session.startingBalance || 0;
        const trades = session.trades || [];
        const closed = trades.filter((t: BacktestSessionTrade) => t.status === 'CLOSED');
        const realizedPnL = closed.reduce(
            (sum, t) => sum + (Number(t.pnlNet) || 0), 0,
        );
        const computedBalance = startBal + realizedPnL;

        // Always set realized P&L from persisted trades — this is the
        // source of truth that survives engine restarts & page refreshes.
        realizedPnLRef.current = realizedPnL;
        balanceRef.current = computedBalance;
        equityRef.current = computedBalance;
        pnlRef.current = realizedPnL;

        const open = trades.filter((t: BacktestSessionTrade) => t.status === 'OPEN');
        if (open.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing from REST query data
            setOpenTrades(prev => {
                if (prev.length > 0) return prev; // WebSocket already populated
                return open.map((t: BacktestSessionTrade) => ({
                    id: t.id,
                    side: t.direction === 'long' ? 'buy' : 'sell',
                    volume: Number(t.quantity),
                    entryPrice: Number(t.entryPrice),
                    entryTime: t.entryDate,
                    sl: t.stopLoss ?? null,
                    tp: t.takeProfit ?? null,
                    unrealizedPnL: 0,
                } as unknown as BacktestTrade));
            });
        }
        // Load closed trades for the history tab
        if (closed.length > 0) {
            setClosedTrades(closed);
        }
    }, [session]);

    const queryClient = useQueryClient();

    const { data: initialCandles, error: candlesError, isLoading: candlesLoading } = useQuery<BacktestCandle[]>({
        queryKey: ['candles', sessionId, activeTimeframe],
        queryFn: async () => {
            const url = `/backtesting/sessions/${sessionId}/candles?resolution=${activeTimeframe}`;
            const res = await api.get(url);
            const raw = res.data;
            if (!Array.isArray(raw)) {
                console.error('[candles query] Response is not an array:', raw);
                return [];
            }
            console.log(`[candles query] Received ${raw.length} candles from backend`);
            return raw.map((c: RawCandle) => ({
                time: Number(c.time),
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
                volume: Number(c.volume || 0),
            }));
        },
        enabled: !!activeTimeframe,
        retry: 1,
    });

    // ─── Pre-session history candles ───
    const { data: historyCandles, isLoading: historyLoading } = useQuery<BacktestCandle[]>({
        queryKey: ['history-candles', sessionId, activeTimeframe],
        queryFn: async () => {
            const url = `/backtesting/sessions/${sessionId}/candles/history?resolution=${activeTimeframe}&limit=500`;
            const res = await api.get(url);
            const raw = res.data;
            if (!Array.isArray(raw)) return [];
            return raw.map((c: RawCandle) => ({
                time: Number(c.time),
                open: Number(c.open),
                high: Number(c.high),
                low: Number(c.low),
                close: Number(c.close),
                volume: Number(c.volume || 0),
            }));
        },
        enabled: !!activeTimeframe,
        retry: 1,
    });

    const chartSeededRef = useRef(false);

    const { initChart, seedChart, updateCandle, seekToCandles, addTradeMarker, chartInstance, candleSeries, registerChartClick } = useBacktestChart(chartContainerRef, resolvedTheme);

    // Sync both the ref (for non-React code) and state (for re-renders)
    const setPlayState = useCallback((val: boolean) => {
        isPlayingRef.current = val;
        setIsPlaying(val);
    }, []);

    // ─── Drawing Tools (shared hook) ───
    const {
        activeTool,
        isDrawingMode,
        pendingClick,
        isLocked,
        isMagnet,
        isVisible,
        handleToolChange,
        handleChartClick,
        handleChartDoubleClick,
        handleFreehandStart,
        handleFreehandMove,
        handleFreehandEnd,
        setChartRefs,
        drawings,
        activePreview,
        addDrawing,
        updateDrawingPoint,
        commitDrawingUpdate,
        toggleDrawingSelection,
        updateDrawing,
        deleteDrawing,
        undo,
        redo,
        canUndo,
        canRedo,
    } = useChartDrawings(sessionId);

    const isFreehandMode = activeTool === 'brush' || activeTool === 'highlighter';

    // ─── Drawing settings dialog state ───
    const [settingsDrawingId, setSettingsDrawingId] = useState<string | null>(null);
    const selectedDrawing = drawings.find(d => d.selected) ?? null;
    const settingsDrawing = drawings.find(d => d.id === settingsDrawingId) ?? null;

    // Connect drawing hook to chart refs after chart initialization
    useEffect(() => {
        if (chartInstance.current && candleSeries.current) {
            setChartRefs(chartInstance.current, candleSeries.current);
        }
    }, [chartInstance, candleSeries, setChartRefs]);

    // Wire chart click events to the drawing handler
    useEffect(() => {
        registerChartClick(handleChartClick);
        return () => registerChartClick(null);
    }, [registerChartClick, handleChartClick]);

    const { play, pause, seek, setSpeed, createOrder, closeTrade, changeTimeframe, connectionStatus } = useBacktestSocket({
        sessionId,
        onUpdate: (update) => {
            // Drop in-flight updates when paused or switching timeframe
            if (!isPlayingRef.current || timeframeSwitchingRef.current) return;

            const raw = update as unknown as RawUpdate;
            const st = (raw.state ?? raw) as Record<string, unknown>;
            indexRef.current = (raw.candle?.index ?? st.replayIndex ?? st.currentIndex ?? 0) as number;
            currentPriceRef.current = (raw.candle?.close ?? st.currentPrice ?? 0) as number;
            // Engine balance already includes realized P&L (effectiveBalance)
            balanceRef.current = (st.balance ?? balanceRef.current) as number;
            const unrealized = (st.unrealizedPnL ?? 0) as number;
            equityRef.current = ((st.balance ?? balanceRef.current) as number) + unrealized;
            pnlRef.current = realizedPnLRef.current + unrealized;
            progressRef.current = (st.progress ?? 0) as number;
            timeRef.current = ((raw.candle?.time ?? st.currentTime ?? 0) as number) + IST_DISPLAY_OFFSET;

            // Push price into React state on every tick so the positions
            // panel P&L recomputes with the latest candle close price.
            // React 18 batches this with setOpenTrades below → single render.
            const tickPrice = currentPriceRef.current;
            setDisplayPrice(prev => prev === tickPrice ? prev : tickPrice);

            const rawTime = Number(raw.candle?.time) || 0;
            if (rawTime > 0) {
                updateCandle({ ...raw.candle, time: rawTime + IST_DISPLAY_OFFSET } as unknown as BacktestCandle);
            }

            // Merge engine positions with existing openTrades.
            // ENGINE is authoritative for what's open, BUT newly confirmed
            // trades may not appear in a stale engine update that was in
            // flight when the order was placed.  Keep prev trades that
            // aren't in the engine yet — onTradeClosed will remove them
            // when the backend confirms closure.
            const enginePositions = raw.openPositions ?? raw.openTrades ?? [];
            setOpenTrades(prev => {
                if (enginePositions.length === 0 && prev.length === 0) return prev;
                // If engine reports 0 positions, keep prev intact — the
                // onTradeClosed events will clean up genuine closures.
                if (enginePositions.length === 0) return prev;

                const engineMap = new Map(enginePositions.map((ep: RawPosition) => [ep.id, ep]));
                const prevMap = new Map(prev.map((t: BacktestTrade) => [t.id, t]));

                // Start with engine positions, enriched with prev data
                const result: BacktestTrade[] = enginePositions.map((ep: RawPosition) => {
                    const existing = prevMap.get(ep.id);
                    if (existing) {
                        return { ...existing, unrealizedPnL: ep.unrealizedPnL ?? 0, mae: ep.mae ?? 0, mfe: ep.mfe ?? 0 };
                    }
                    return {
                        ...ep,
                        side: ep.side || (ep.direction === 'long' ? 'buy' : 'sell'),
                        volume: ep.volume ?? Number(ep.quantity),
                        entryPrice: Number(ep.entryPrice),
                    } as unknown as BacktestTrade;
                });

                // Preserve prev trades not yet in engine (stale update)
                for (const pt of prev) {
                    if (!engineMap.has(pt.id)) {
                        result.push(pt);
                    }
                }

                return result;
            });
        },
        onStateSync: (state) => {
            const raw = state as unknown as RawUpdate;

            // Timeframe change response — only update index, keep existing
            // refs intact so the seeding effect can correctly slice candles
            // at the current replay position. The chart rebuild is driven
            // by React Query refetch + seeding effect.
            if (raw.timeframeChanged) {
                indexRef.current = (raw.newIndex ?? 0) as number;
                // timeframeSwitchingRef stays true until the seeding effect
                // finishes with the new candle data.
                return;
            }

            const st = (raw.state ?? raw) as Record<string, unknown>;
            const trigger = raw.trigger as string | undefined;

            // For play/pause confirmations, use the trigger type as the
            // authoritative signal — the engine status may still be 'ready'
            // at the moment state_sync is emitted (before startEngine).
            if (trigger === 'play') {
                setPlayState(true);
                return;
            }
            if (trigger === 'pause') {
                setPlayState(false);
                return;
            }

            // Subscribe / other triggers — sync play state from engine status
            const backendStatus = st.status;
            if (backendStatus !== undefined) {
                setPlayState(isEnginePlaying(backendStatus));
            }

            // Subscribe / other triggers — full state sync
            indexRef.current = (raw.candle?.index ?? st.replayIndex ?? st.currentIndex ?? 0) as number;
            currentPriceRef.current = (raw.candle?.close ?? st.currentPrice ?? 0) as number;
            // Engine balance already accounts for realized P&L on restart
            balanceRef.current = (st.balance ?? balanceRef.current) as number;
            const syncUnrealized = (st.unrealizedPnL ?? 0) as number;
            equityRef.current = ((st.balance ?? balanceRef.current) as number) + syncUnrealized;
            pnlRef.current = realizedPnLRef.current + syncUnrealized;
            progressRef.current = (st.progress ?? 0) as number;
            timeRef.current = ((raw.candle?.time ?? st.currentTime ?? 0) as number) + IST_DISPLAY_OFFSET;
            setOpenTrades((raw.openPositions ?? raw.openTrades ?? []) as unknown as BacktestTrade[]);

            if (initialCandles && !timeframeSwitchingRef.current) {
                const history = historyCandles ?? [];
                const combined = [...history, ...initialCandles];
                const shifted = combined.map(c => ({ ...c, time: c.time + IST_DISPLAY_OFFSET }));
                seekToCandles(shifted, history.length + indexRef.current);
            }
        },
        onCompleted: (data) => {
            setPlayState(false);
            alert(`Session Completed! Final Balance: ${data.finalBalance}`);
        },
        onError: (err) => {
            console.error('Socket error:', err);
            setOrderSubmitting(false);
            setOrderError(err);
            setPlayState(false);
        },
        onOrderConfirmed: (data) => {
            setOrderSubmitting(false);
            setOrderError(null);
            setActiveTab('positions');
            if (data.trade) {
                const t = data.trade;
                const side = t.direction === 'long' ? 'buy' : 'sell';
                // Immediately add the new position to openTrades so the panel updates
                setOpenTrades(prev => {
                    if (prev.some(p => p.id === t.id)) return prev;
                    return [...prev, {
                        ...t,
                        id: t.id,
                        side,
                        volume: Number(t.quantity),
                        entryPrice: Number(t.entryPrice),
                        entryTime: t.entryDate,
                        sl: t.stopLoss ?? t.sl ?? null,
                        tp: t.takeProfit ?? t.tp ?? null,
                        unrealizedPnL: 0,
                    }];
                });
                // Add entry marker on chart — use timeRef (IST-shifted
                // chart time) so the marker matches an existing chart bar.
                if (candleSeries.current) {
                    addTradeMarker({
                        ...t,
                        side,
                        volume: Number(t.quantity),
                        entryTime: timeRef.current, // already IST-shifted
                        entryPrice: Number(t.entryPrice),
                        pnlNet: 0,
                    } as unknown as BacktestTrade, 'entry', 0);
                }
            }
        },
        onTradeClosed: (data) => {
            if (data.trade) {
                const t = data.trade;
                // Remove the closed trade from openTrades
                setOpenTrades(prev => prev.filter(p => p.id !== t.id));
                // Accumulate realized P&L so the top-bar total stays correct
                const tradePnl = Number(t.pnlNet) || 0;
                realizedPnLRef.current += tradePnl;
                // Update balance immediately so the top-bar reflects the
                // closed trade without waiting for the next engine tick.
                balanceRef.current += tradePnl;
                equityRef.current = balanceRef.current;
                pnlRef.current = realizedPnLRef.current;
                // Add to closed trades history
                setClosedTrades(prev => {
                    if (prev.some(p => p.id === t.id)) return prev;
                    return [{
                        id: t.id,
                        symbol: t.symbol ?? session?.instrument ?? '',
                        direction: t.direction,
                        entryDate: t.entryDate,
                        exitDate: t.exitDate ?? null,
                        entryPrice: Number(t.entryPrice),
                        exitPrice: t.exitPrice != null ? Number(t.exitPrice) : null,
                        quantity: Number(t.quantity),
                        stopLoss: t.stopLoss != null ? Number(t.stopLoss) : null,
                        takeProfit: t.takeProfit != null ? Number(t.takeProfit) : null,
                        pnlGross: t.pnlGross != null ? Number(t.pnlGross) : null,
                        pnlNet: t.pnlNet != null ? Number(t.pnlNet) : null,
                        status: 'CLOSED',
                    }, ...prev];
                });
                // Add exit marker on chart — use timeRef for guaranteed bar match
                if (candleSeries.current) {
                    addTradeMarker({
                        ...t,
                        side: t.direction === 'long' ? 'buy' : 'sell',
                        volume: Number(t.quantity),
                        exitTime: timeRef.current, // already IST-shifted
                        pnlNet: Number(t.pnlNet) || 0,
                    } as unknown as BacktestTrade, 'exit', 0);
                }
            }
        },
    });

    // When the user switches timeframe, reset the chart seed flag so new data reseeds
    const handleTimeframeChange = useCallback((tf: string) => {
        if (tf === activeTimeframe) return;
        // Pause engine before switching (if playing)
        if (isPlayingRef.current) {
            pause();
            setPlayState(false);
        }
        // Block updates during transition
        timeframeSwitchingRef.current = true;
        setActiveTimeframe(tf);
        chartSeededRef.current = false;
        // Tell the backend to destroy the old engine and reload candles at the new resolution
        changeTimeframe(tf);
        // Invalidate candle queries so React Query refetches at the new resolution
        queryClient.invalidateQueries({ queryKey: ['candles', sessionId] });
        queryClient.invalidateQueries({ queryKey: ['history-candles', sessionId] });
        // Invalidate session so session.timeframe reflects the change
        queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    }, [activeTimeframe, changeTimeframe, pause, setPlayState, queryClient, sessionId]);

    // Seed chart with pre-session history candles so the chart is never blank.
    // When the user switches timeframe mid-session, we also include session
    // candles up to the current replay time so a timeframe switch doesn't lose
    // the already-played portion.
    useEffect(() => {
        if (chartSeededRef.current) return;
        // Wait for session candles to arrive
        if (initialCandles === undefined) return;
        // Wait for history query to settle (success OR error)
        if (historyLoading) return;

        const history = historyCandles ?? [];

        // If the replay is mid-session (timeRef > 0), include session candles
        // up to the current replay time so a timeframe switch doesn't lose
        // the already-played portion.
        const currentTime = timeRef.current;
        let sessionSlice: BacktestCandle[] = [];
        if (currentTime > 0 && initialCandles.length > 0) {
            // currentTime already includes IST_DISPLAY_OFFSET, so compare
            // with shifted candle times to avoid seeding extra candles
            sessionSlice = initialCandles.filter(c => (c.time + IST_DISPLAY_OFFSET) <= currentTime);
        }

        const combined = [...history, ...sessionSlice];

        if (combined.length > 0) {
            const shifted = combined.map(c => ({ ...c, time: c.time + IST_DISPLAY_OFFSET }));
            seedChart(shifted);
            chartSeededRef.current = true;
            // Initialize currentPriceRef from the last seeded candle so
            // orders can be placed immediately, even before replay starts.
            const lastCandle = combined[combined.length - 1];
            if (lastCandle && currentPriceRef.current === 0) {
                currentPriceRef.current = lastCandle.close;
            }
            console.log(`[page] Chart seeded: ${history.length} history + ${sessionSlice.length} session candles (total ${shifted.length}).`);
        } else if (initialCandles && initialCandles.length > 0) {
            // Session candles exist but none were selected (currentTime=0,
            // replay hasn't started yet). Seed with the first candle so
            // the chart isn't blank and the price ref is initialised.
            const first = initialCandles[0];
            seedChart([{ ...first, time: first.time + IST_DISPLAY_OFFSET }]);
            chartSeededRef.current = true;
            if (currentPriceRef.current === 0) {
                currentPriceRef.current = first.close;
            }
            console.log('[page] Chart seeded with first session candle.');
        } else {
            // No candles at all — init empty chart for replay
            initChart();
            chartSeededRef.current = true;
            console.log('[page] No candles available. Chart initialized empty.');
        }

        // Timeframe switch complete — unblock updates
        timeframeSwitchingRef.current = false;
    }, [historyCandles, historyLoading, initialCandles, seedChart, initChart]);

    useEffect(() => {
        let frameId: number;
        const fmt = (v: unknown) => {
            const n = Number(v) || 0;
            return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        };
        const renderLoop = () => {
            if (domBalanceRef.current) domBalanceRef.current.innerText = `$${fmt(balanceRef.current)}`;
            if (domEquityRef.current) domEquityRef.current.innerText = `$${fmt(equityRef.current)}`;
            if (domPnlRef.current) {
                const val = Number(pnlRef.current) || 0;
                domPnlRef.current.innerText = `${val >= 0 ? '+' : ''}$${fmt(val)}`;
                domPnlRef.current.className = val >= 0 ? 'text-[#00d4aa] font-medium' : 'text-[#ff4444] font-medium';
            }
            if (domPriceRef.current && currentPriceRef.current) {
                domPriceRef.current.innerText = Number(currentPriceRef.current).toFixed(5);
            }
            frameId = requestAnimationFrame(renderLoop);
        };
        renderLoop();
        return () => cancelAnimationFrame(frameId);
    }, []);

    const handlePlayPause = useCallback(() => {
        if (connectionStatus !== 'connected') return;

        if (isPlayingRef.current) {
            pause();
            setPlayState(false);
        } else {
            play(replaySpeed);
            // Set optimistically so incoming updates aren't dropped if
            // state_sync arrives late or is missed during reconnection.
            setPlayState(true);
        }
    }, [connectionStatus, play, pause, replaySpeed, setPlayState]);

    // When seek is requested, rebuild the chart from initialCandles up to that index
    const handleSeek = useCallback((index: number) => {
        // Tell the backend engine to seek
        seek(index);
        // Immediately update refs so the counter/time labels update
        indexRef.current = index;
        if (initialCandles && initialCandles[index]) {
            timeRef.current = initialCandles[index].time + IST_DISPLAY_OFFSET;
            currentPriceRef.current = initialCandles[index].close;
        }
        // Rebuild chart locally from the pre-fetched candle data
        if (initialCandles && initialCandles.length > 0) {
            const history = historyCandles ?? [];
            const combined = [...history, ...initialCandles];
            const shifted = combined.map(c => ({ ...c, time: c.time + IST_DISPLAY_OFFSET }));
            seekToCandles(shifted, history.length + index);
        }
    }, [seek, initialCandles, historyCandles, seekToCandles]);

    const handleSpeedChange = (speed: ReplaySpeed) => {
        setReplaySpeed(speed);
        setSpeed(speed);
    };

    const submitOrder = (side: 'buy' | 'sell') => {
        if (orderSubmitting || connectionStatus !== 'connected') return;
        const direction = side === 'buy' ? 'long' : 'short';
        const sl = orderForm.sl ? Number(orderForm.sl) : undefined;
        const tp = orderForm.tp ? Number(orderForm.tp) : undefined;

        // Resolve the best available price: ref → loaded candle data → let backend decide
        let resolvedPrice = currentPriceRef.current;
        if (!resolvedPrice || resolvedPrice <= 0) {
            // Fallback: use the candle at the current replay index
            const idx = indexRef.current;
            if (initialCandles && initialCandles[idx]) {
                resolvedPrice = initialCandles[idx].close;
                currentPriceRef.current = resolvedPrice; // cache for future use
            }
        }

        let price: number | undefined;
        let stopPrice: number | undefined;

        if (orderForm.type === 'market') {
            // For market orders, send the resolved price or undefined to let
            // the backend use its engine-based fallback
            price = resolvedPrice > 0 ? resolvedPrice : undefined;
        } else if (orderForm.type === 'limit') {
            price = orderForm.price ? Number(orderForm.price) : (resolvedPrice > 0 ? resolvedPrice : undefined);
        } else if (orderForm.type === 'stop') {
            stopPrice = orderForm.price ? Number(orderForm.price) : (resolvedPrice > 0 ? resolvedPrice : undefined);
            price = resolvedPrice > 0 ? resolvedPrice : undefined;
        }

        if (!orderForm.volume || orderForm.volume <= 0) {
            setOrderError('Invalid volume');
            return;
        }

        const dto: CreateOrderDto = {
            orderType: orderForm.type,
            direction,
            quantity: orderForm.volume,
            price,
            stopPrice,
            sl,
            tp,
        };
        setOrderSubmitting(true);
        setOrderError(null);
        createOrder(dto);
        // Safety timeout: reset submitting state if no response within 10s
        setTimeout(() => {
            setOrderSubmitting(false);
        }, 10000);
    };

    // Pip size helper based on instrument
    const pipSize = (() => {
        const sym = (session?.instrument || '').toUpperCase();
        if (sym.includes('JPY')) return 0.01;
        if (sym === 'XAUUSD') return 0.1;
        if (sym.includes('BTC') || sym.includes('ETH')) return 1;
        if (sym.includes('US30') || sym.includes('NAS') || sym.includes('SPX')) return 0.1;
        return 0.0001;
    })();
    const priceDecimals = pipSize >= 1 ? 0 : pipSize >= 0.1 ? 1 : pipSize >= 0.01 ? 2 : 5;

    // Contract size per lot based on instrument
    const contractSize = (() => {
        const sym = (session?.instrument || '').toUpperCase();
        if (sym === 'XAUUSD') return 100;
        if (sym === 'XAGUSD') return 5000;
        if (sym.includes('BTC') || sym.includes('ETH')) return 1;
        if (sym.includes('US30')) return 1;
        if (sym.includes('US500') || sym.includes('SPX')) return 50;
        if (sym.includes('NAS')) return 20;
        return 100_000;
    })();

    const adjustTP = (delta: number) => {
        const current = orderForm.tp ? Number(orderForm.tp) : currentPriceRef.current;
        setOrderForm(p => ({ ...p, tp: (current + delta * pipSize).toFixed(priceDecimals) }));
    };
    const adjustSL = (delta: number) => {
        const current = orderForm.sl ? Number(orderForm.sl) : currentPriceRef.current;
        setOrderForm(p => ({ ...p, sl: (current + delta * pipSize).toFixed(priceDecimals) }));
    };

    // ─── PriceScaleMenu action handlers ───
    const handlePriceScaleSellLimit = useCallback((price: number) => {
        if (connectionStatus !== 'connected') return;
        createOrder({
            orderType: 'limit',
            direction: 'short',
            quantity: orderForm.volume,
            price,
        } as unknown as CreateOrderDto);
    }, [connectionStatus, createOrder, orderForm.volume]);

    const handlePriceScaleBuyStop = useCallback((price: number) => {
        if (connectionStatus !== 'connected') return;
        createOrder({
            orderType: 'stop',
            direction: 'long',
            quantity: orderForm.volume,
            stopPrice: price,
            price: currentPriceRef.current > 0 ? currentPriceRef.current : undefined,
        } as unknown as CreateOrderDto);
    }, [connectionStatus, createOrder, orderForm.volume]);

    const handlePriceScaleAddOrder = useCallback((price: number) => {
        setOrderForm(p => ({ ...p, price: price.toFixed(priceDecimals), type: 'limit' }));
        setActiveTab('order');
    }, [priceDecimals]);

    const handlePriceScaleDrawHLine = useCallback((price: number) => {
        const clickTime = Math.floor(Date.now() / 1000);
        addDrawing({
            type: 'hline',
            points: [{ time: clickTime, price }],
            style: { color: '#787B86', lineWidth: 1, lineStyle: 'dashed' },
        });
    }, [addDrawing]);

    const [alerts, setAlerts] = useState<OverlayAlert[]>([]);

    const instrumentName = (session?.instrument || '').toUpperCase();
    // eslint-disable-next-line react-hooks/preserve-manual-memoization -- instrumentName is the effective dep
    const handlePriceScaleAddAlert = useCallback((price: number) => {
        setAlerts(prev => [...prev, {
            id: `alert_${Date.now()}`,
            targetPrice: price,
            symbol: instrumentName,
            triggered: false,
        }]);
    }, [instrumentName]);



    // Estimated P&L for TP/SL — use latest price from rAF-synced state
    // instead of accessing ref during render
    const [displayPrice, setDisplayPrice] = useState(0);

    // Sync displayPrice from ref on an interval (avoids ref access during render)
    useEffect(() => {
        const id = setInterval(() => {
            const price = currentPriceRef.current;
            // Functional update avoids stale closure — only triggers
            // re-render when the price actually changed.
            setDisplayPrice(prev => prev === price ? prev : price);
        }, 200);
        return () => clearInterval(id);
    }, []);

    // ─── Alert price-crossing check ───
    const prevAlertPriceRef = useRef<number>(0);
    useEffect(() => {
        if (alerts.length === 0 || displayPrice <= 0) return;
        const prev = prevAlertPriceRef.current;
        if (prev <= 0) { prevAlertPriceRef.current = displayPrice; return; }

        const untriggered = alerts.filter(a => !a.triggered);
        const triggered: string[] = [];
        for (const a of untriggered) {
            // Price crossed the alert level
            if ((prev < a.targetPrice && displayPrice >= a.targetPrice) || (prev > a.targetPrice && displayPrice <= a.targetPrice)) {
                triggered.push(a.id);
            }
        }
        if (triggered.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- updating alert state from price-crossing detection
            setAlerts(p => p.map(a => triggered.includes(a.id) ? { ...a, triggered: true } : a));
            for (const id of triggered) {
                const a = alerts.find(x => x.id === id);
                if (a) {
                    // Visual alert notification
                    const msg = `Alert triggered: ${a.symbol} reached ${a.targetPrice.toFixed(priceDecimals)}`;
                    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                        new Notification(msg);
                    }
                    console.log(`[Alert] ${msg}`);
                }
            }
        }
        prevAlertPriceRef.current = displayPrice;
    }, [displayPrice, alerts, priceDecimals]);

    const calcEstPnL = (targetPrice: number, side: 'buy' | 'sell') => {
        const entry = displayPrice;
        const qty = orderForm.volume;
        const priceDiff = side === 'buy'
            ? targetPrice - entry
            : entry - targetPrice;
        return priceDiff * contractSize * qty;
    };

    // Update chart price lines for open positions.
    // Only recreate when trade composition changes (not on PnL ticks).
    useEffect(() => {
        const series = candleSeries.current;
        if (!series) return;

        // Build stable identity key — only recreate lines when trades
        // are added/removed or their entry/SL/TP values change.
        const key = openTrades.map((t: BacktestTrade) =>
            `${t.id}:${Number(t.entryPrice)}:${Number(t.sl ?? 0)}:${Number(t.tp ?? 0)}`
        ).join('|');
        if (key === prevTradeLineKeyRef.current) return;
        prevTradeLineKeyRef.current = key;

        // Remove old lines
        priceLinesRef.current.forEach(line => {
            try { series.removePriceLine(line); } catch {}
        });
        priceLinesRef.current = [];

        // Compute contract size inside effect to keep dependency array stable
        const sym = (session?.instrument || '').toUpperCase();
        const cs = sym === 'XAUUSD' ? 100
            : sym === 'XAGUSD' ? 5000
            : (sym.includes('BTC') || sym.includes('ETH')) ? 1
            : sym.includes('US30') ? 1
            : (sym.includes('US500') || sym.includes('SPX')) ? 50
            : sym.includes('NAS') ? 20
            : 100_000;

        openTrades.forEach((trade: BacktestTrade) => {
            try {
            const entry = Number(trade.entryPrice);
            const side = trade.side || (trade.direction === 'long' ? 'buy' : 'sell');
            const isBuy = side === 'buy';

            // Entry line
            const entryLine = series.createPriceLine({
                price: entry,
                color: isBuy ? '#00d4aa' : '#ff4444',
                lineWidth: 2,
                lineStyle: 2, // Dotted
                axisLabelVisible: true,
                title: `${isBuy ? 'Buy' : 'Sell'} ${trade.volume ?? trade.quantity} ${orderForm.type === 'market' ? '' : orderForm.type}`.trim(),
            });
            priceLinesRef.current.push(entryLine);

            // TP line
            const tp = Number(trade.tp ?? trade.takeProfit);
            if (tp > 0) {
                const tpPnl = isBuy
                    ? (tp - entry) * Number(trade.volume ?? trade.quantity) * cs
                    : (entry - tp) * Number(trade.volume ?? trade.quantity) * cs;
                const tpLine = series.createPriceLine({
                    price: tp,
                    color: '#00d4aa',
                    lineWidth: 1,
                    lineStyle: 1, // Dashed
                    axisLabelVisible: true,
                    title: `${Number(trade.volume ?? trade.quantity).toFixed(3)}  +${tpPnl.toFixed(2)} USD`,
                });
                priceLinesRef.current.push(tpLine);
            }

            // SL line
            const sl = Number(trade.sl ?? trade.stopLoss);
            if (sl > 0) {
                const slPnl = isBuy
                    ? (sl - entry) * Number(trade.volume ?? trade.quantity) * cs
                    : (entry - sl) * Number(trade.volume ?? trade.quantity) * cs;
                const slLine = series.createPriceLine({
                    price: sl,
                    color: '#ff4444',
                    lineWidth: 1,
                    lineStyle: 1, // Dashed
                    axisLabelVisible: true,
                    title: `${Number(trade.volume ?? trade.quantity).toFixed(3)}  ${slPnl.toFixed(2)} USD`,
                });
                priceLinesRef.current.push(slLine);
            }
            } catch { /* series disposed during HMR */ }
        });
    }, [openTrades, candleSeries, orderForm.type, session?.instrument]);

    // ═══════════════════════════════════════════════════════════════
    // Order form TP/SL preview lines on chart (draggable)
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const series = candleSeries.current;
        if (!series) return;

        const showLines = activeTab === 'order';
        const entryPrice = displayPrice || currentPriceRef.current;
        const vol = orderForm.volume;
        const hasTP = showLines && !!orderForm.tp && Number(orderForm.tp) > 0;
        const hasSL = showLines && !!orderForm.sl && Number(orderForm.sl) > 0;

        // ── TP line ──
        if (hasTP) {
            const tpPrice = Number(orderForm.tp);
            const tpPnl = (tpPrice - entryPrice) * contractSize * vol;
            const tpTitle = `TP  ${tpPnl >= 0 ? '+' : ''}${tpPnl.toFixed(2)} USD   ⋮⋮`;
            if (orderTPLineRef.current) {
                try { orderTPLineRef.current.applyOptions({ price: tpPrice, title: tpTitle }); } catch { orderTPLineRef.current = null; }
            }
            if (!orderTPLineRef.current) {
                try {
                    orderTPLineRef.current = series.createPriceLine({
                        price: tpPrice, color: '#00d4aa', lineWidth: 2, lineStyle: 2,
                        axisLabelVisible: true, title: tpTitle,
                    });
                } catch {}
            }
        } else if (orderTPLineRef.current) {
            try { series.removePriceLine(orderTPLineRef.current); } catch {}
            orderTPLineRef.current = null;
        }

        // ── SL line ──
        if (hasSL) {
            const slPrice = Number(orderForm.sl);
            const slPnl = (slPrice - entryPrice) * contractSize * vol;
            const slTitle = `SL  ${slPnl >= 0 ? '+' : ''}${slPnl.toFixed(2)} USD   ⋮⋮`;
            if (orderSLLineRef.current) {
                try { orderSLLineRef.current.applyOptions({ price: slPrice, title: slTitle }); } catch { orderSLLineRef.current = null; }
            }
            if (!orderSLLineRef.current) {
                try {
                    orderSLLineRef.current = series.createPriceLine({
                        price: slPrice, color: '#ff4444', lineWidth: 2, lineStyle: 2,
                        axisLabelVisible: true, title: slTitle,
                    });
                } catch {}
            }
        } else if (orderSLLineRef.current) {
            try { series.removePriceLine(orderSLLineRef.current); } catch {}
            orderSLLineRef.current = null;
        }

        // ── Entry reference line (shown when either TP or SL is set) ──
        if (showLines && (hasTP || hasSL) && entryPrice > 0) {
            const entryTitle = `${orderForm.type !== 'market' ? orderForm.type.toUpperCase() : 'MARKET'}  ${vol.toFixed(2)}`;
            if (orderEntryLineRef.current) {
                try { orderEntryLineRef.current.applyOptions({ price: entryPrice, title: entryTitle }); } catch { orderEntryLineRef.current = null; }
            }
            if (!orderEntryLineRef.current) {
                try {
                    orderEntryLineRef.current = series.createPriceLine({
                        price: entryPrice, color: '#2962FF', lineWidth: 2, lineStyle: 0,
                        axisLabelVisible: true, title: entryTitle,
                    });
                } catch {}
            }
        } else if (orderEntryLineRef.current) {
            try { series.removePriceLine(orderEntryLineRef.current); } catch {}
            orderEntryLineRef.current = null;
        }
    }, [activeTab, orderForm.tp, orderForm.sl, orderForm.volume, orderForm.type, displayPrice, candleSeries, contractSize]);

    // ═══════════════════════════════════════════════════════════════
    // Drag interaction for order TP/SL lines
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container) return;

        const DRAG_THRESHOLD = 10; // px proximity to "grab" a line

        const getPriceY = (line: IPriceLine | null): number | null => {
            const series = candleSeries.current;
            if (!series || !line) return null;
            try { return series.priceToCoordinate(line.options().price) as number | null; } catch { return null; }
        };

        const yToPrice = (y: number): number | null => {
            const series = candleSeries.current;
            if (!series) return null;
            try {
                const p = series.coordinateToPrice(y);
                return (p !== null && isFinite(p) && p > 0) ? p : null;
            } catch { return null; }
        };

        const onPointerDown = (e: PointerEvent) => {
            const series = candleSeries.current;
            if (!series) return;
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;

            // Check proximity to TP line
            const tpY = getPriceY(orderTPLineRef.current);
            if (tpY !== null && Math.abs(y - tpY) < DRAG_THRESHOLD) {
                draggingLineRef.current = 'tp';
                container.setPointerCapture(e.pointerId);
                container.style.cursor = 'ns-resize';
                e.preventDefault();
                return;
            }

            // Check proximity to SL line
            const slY = getPriceY(orderSLLineRef.current);
            if (slY !== null && Math.abs(y - slY) < DRAG_THRESHOLD) {
                draggingLineRef.current = 'sl';
                container.setPointerCapture(e.pointerId);
                container.style.cursor = 'ns-resize';
                e.preventDefault();
                return;
            }
        };

        const onPointerMove = (e: PointerEvent) => {
            const series = candleSeries.current;
            if (!series) return;
            const rect = container.getBoundingClientRect();
            const y = e.clientY - rect.top;

            if (!draggingLineRef.current) {
                // Cursor hint: show ns-resize when hovering near a draggable line
                const tpY = getPriceY(orderTPLineRef.current);
                const slY = getPriceY(orderSLLineRef.current);
                const nearTP = tpY !== null && Math.abs(y - tpY) < DRAG_THRESHOLD;
                const nearSL = slY !== null && Math.abs(y - slY) < DRAG_THRESHOLD;
                container.style.cursor = (nearTP || nearSL) ? 'ns-resize' : '';
                return;
            }

            // Active drag — update price
            const newPrice = yToPrice(y);
            if (newPrice === null) return;

            if (draggingLineRef.current === 'tp') {
                if (orderTPLineRef.current) {
                    try { orderTPLineRef.current.applyOptions({ price: newPrice }); } catch {}
                }
                setOrderForm(p => ({ ...p, tp: newPrice.toFixed(priceDecimals) }));
            } else if (draggingLineRef.current === 'sl') {
                if (orderSLLineRef.current) {
                    try { orderSLLineRef.current.applyOptions({ price: newPrice }); } catch {}
                }
                setOrderForm(p => ({ ...p, sl: newPrice.toFixed(priceDecimals) }));
            }
            e.preventDefault();
        };

        const onPointerUp = (e: PointerEvent) => {
            if (draggingLineRef.current) {
                draggingLineRef.current = null;
                container.releasePointerCapture(e.pointerId);
                container.style.cursor = '';
            }
        };

        container.addEventListener('pointerdown', onPointerDown);
        container.addEventListener('pointermove', onPointerMove);
        container.addEventListener('pointerup', onPointerUp);

        return () => {
            container.removeEventListener('pointerdown', onPointerDown);
            container.removeEventListener('pointermove', onPointerMove);
            container.removeEventListener('pointerup', onPointerUp);
            container.style.cursor = '';
        };
    }, [candleSeries, priceDecimals]);

    return (
        <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
            {/* TOP BAR */}
            <div className="h-12 bg-card border-b border-border flex items-center px-4 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.push('/backtesting')} className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-muted rounded text-xs font-bold text-foreground">{session?.instrument || '...'}</span>
                    </div>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Timeframe selector */}
                    <div className="flex items-center gap-1">
                        {TIMEFRAMES.map(tf => (
                            <button
                                key={tf}
                                onClick={() => handleTimeframeChange(tf)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                                    (activeTimeframe || session?.timeframe) === tf
                                        ? 'bg-[#00d4aa] text-[#0a0a0f]'
                                        : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
                                }`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-4 bg-border mx-1" />

                    <div className="flex items-center gap-2 text-xs font-medium">
                        <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-[#00d4aa]' : 'bg-yellow-500'}`} />
                        <span className="text-muted-foreground">{connectionStatus}</span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Balance</span>
                        <span ref={domBalanceRef} className="font-mono text-sm leading-none mt-0.5">$0.00</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Equity</span>
                        <span ref={domEquityRef} className="font-mono text-sm leading-none mt-0.5">$0.00</span>
                    </div>
                    <div className="flex flex-col text-right min-w-20">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">P&L</span>
                        <span ref={domPnlRef} className="font-mono text-sm leading-none mt-0.5">$0.00</span>
                    </div>

                    <button
                        onClick={() => setDetectorOpen(true)}
                        className="ml-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold transition-colors"
                    >
                        <Radar className="w-4 h-4" />
                        Detect
                    </button>
                    <button
                        onClick={() => setValidatorOpen(true)}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold transition-colors"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        Validate
                    </button>
                    <button
                        onClick={() => router.push(`/backtesting/${sessionId}/report`)}
                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold transition-colors"
                    >
                        <BarChart3 className="w-4 h-4" />
                        Report
                    </button>
                </div>
            </div>

            {/* MAIN AREA */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* DRAWING TOOLBAR */}
                <ChartToolbar
                    activeTool={activeTool}
                    onToolChange={handleToolChange}
                    pendingClick={pendingClick}
                    isLocked={isLocked}
                    isMagnet={isMagnet}
                    isVisible={isVisible}
                    onUndo={undo}
                    onRedo={redo}
                    canUndo={canUndo}
                    canRedo={canRedo}
                />

                {/* CENTER: Chart + Playback */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Chart area with overlays */}
                    <div className="flex-1 relative min-h-0">
                        <div className="absolute top-4 left-4 z-10 pointer-events-none">
                            <div className="bg-card/80 backdrop-blur-sm border border-border p-3 rounded-lg flex items-center gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Market</span>
                                    <span ref={domPriceRef} className="font-mono text-lg font-bold text-foreground mt-0.5">0.00000</span>
                                </div>
                            </div>
                        </div>

                        {/* Candle error overlay */}
                        {candlesError && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90">
                                <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
                                    <p className="text-red-400 font-bold mb-2">Failed to load candle data</p>
                                    <p className="text-muted-foreground text-sm mb-4">{(candlesError as Error).message}</p>
                                    <p className="text-muted-foreground text-xs">Check <code className="text-muted-foreground">GET /backtesting/debug/candles</code> to diagnose symbol/resolution mismatch</p>
                                </div>
                            </div>
                        )}
                        {!candlesError && !candlesLoading && initialCandles?.length === 0 && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90">
                                <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-lg p-6 max-w-md text-center">
                                    <p className="text-yellow-400 font-bold mb-2">No candle data found</p>
                                    <p className="text-muted-foreground text-sm">The database returned 0 candles for this session&apos;s symbol/resolution/date range.</p>
                                </div>
                            </div>
                        )}

                        <div ref={chartContainerRef} className={`h-full w-full ${isDrawingMode ? '**:cursor-crosshair!' : ''}`} />
                        <DrawingLayer
                            chartRef={chartInstance}
                            seriesRef={candleSeries}
                            containerRef={chartContainerRef}
                            drawings={drawings}
                            activePreview={activePreview}
                            isFreehand={isFreehandMode}
                            onFreehandStart={handleFreehandStart}
                            onFreehandMove={handleFreehandMove}
                            onFreehandEnd={handleFreehandEnd}
                            onDoubleClick={handleChartDoubleClick}
                            onDrawingPointDrag={updateDrawingPoint}
                            onDrawingPointDragEnd={commitDrawingUpdate}
                            onDrawingSelect={toggleDrawingSelection}
                        />
                        {/* Drawing floating toolbar */}
                        {selectedDrawing && (
                            <DrawingToolbar
                                drawing={selectedDrawing}
                                onOpenSettings={(id) => setSettingsDrawingId(id)}
                                onDelete={(id) => { deleteDrawing(id); toggleDrawingSelection(null); }}
                                onToggleLock={(id) => updateDrawing(id, { locked: !selectedDrawing.locked })}
                                onToggleVisibility={(id) => updateDrawing(id, { visible: !selectedDrawing.visible })}
                                onStyleChange={(id, updates) => updateDrawing(id, updates)}
                            />
                        )}
                        {/* Fib settings dialog (modal) */}
                        {settingsDrawing && (settingsDrawing.type === 'fibonacci' || settingsDrawing.type === 'fib-trend-ext') && (
                            <FibSettingsDialog
                                drawing={settingsDrawing}
                                onApply={(id, updates) => { updateDrawing(id, updates); setSettingsDrawingId(null); }}
                                onClose={() => setSettingsDrawingId(null)}
                            />
                        )}
                        <DraggableAlertOverlay
                            alerts={alerts}
                            activeSymbol={instrumentName}
                            priceDecimals={priceDecimals}
                            chartRef={chartInstance}
                            seriesRef={candleSeries}
                            containerRef={chartContainerRef}
                            onDelete={(id) => setAlerts(prev => prev.filter(a => a.id !== id))}
                            onUpdatePrice={async (id, newPrice) => {
                                setAlerts(prev => prev.map(a => a.id === id ? { ...a, targetPrice: newPrice } : a));
                            }}
                        />
                        <PriceScaleMenu
                            chartRef={chartInstance}
                            seriesRef={candleSeries}
                            containerRef={chartContainerRef}
                            instrument={session?.instrument || ''}
                            priceDecimals={priceDecimals}
                            orderVolume={orderForm.volume}
                            onSellLimit={handlePriceScaleSellLimit}
                            onBuyStop={handlePriceScaleBuyStop}
                            onAddOrder={handlePriceScaleAddOrder}
                            onAddAlert={handlePriceScaleAddAlert}
                            onDrawHLine={handlePriceScaleDrawHLine}
                        />
                    </div>
                    <PlaybackControls
                        onPlayPause={handlePlayPause}
                        onSeek={handleSeek}
                        onSpeedChange={handleSpeedChange}
                        totalCandles={initialCandles?.length || session?.totalCandles || 0}
                        replaySpeed={replaySpeed}
                        isPlaying={isPlaying}
                        progressRef={progressRef}
                        indexRef={indexRef}
                        timeRef={timeRef}
                    />
                </div>

                {/* RIGHT PANEL: Trading */}
                <div className="w-[320px] max-w-[320px] min-w-[320px] bg-card border-l border-border flex flex-col shrink-0 z-20">
                    <div className="flex border-b border-border">
                        <button
                            className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'order' ? 'border-[#00d4aa] text-[#00d4aa]' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('order')}
                        >
                            Order
                        </button>
                        <button
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'positions' ? 'border-indigo-400 text-indigo-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('positions')}
                        >
                            Positions
                            {openTrades.length > 0 && <span className="bg-indigo-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{openTrades.length}</span>}
                        </button>
                        <button
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'history' ? 'border-amber-400 text-amber-400' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                            onClick={() => setActiveTab('history')}
                        >
                            History
                            {closedTrades.length > 0 && <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{closedTrades.length}</span>}
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            {activeTab === 'order' && (
                                <motion.div
                                    key="order"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4"
                                >
                                    <div className="flex justify-between items-center bg-muted/50 p-1 rounded-md border border-border/50">
                                        <button onClick={() => setOrderForm({ ...orderForm, type: 'market' })} className={`flex-1 py-1 px-2 text-xs font-medium rounded ${orderForm.type === 'market' ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground'}`}>Market</button>
                                        <button onClick={() => setOrderForm({ ...orderForm, type: 'limit' })} className={`flex-1 py-1 px-2 text-xs font-medium rounded ${orderForm.type === 'limit' ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground'}`}>Limit</button>
                                        <button onClick={() => setOrderForm({ ...orderForm, type: 'stop' })} className={`flex-1 py-1 px-2 text-xs font-medium rounded ${orderForm.type === 'stop' ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground'}`}>Stop</button>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground font-medium">Volume (Lots)</label>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setOrderForm(p => ({ ...p, volume: Math.max(0.01, Math.round((p.volume - 0.1) * 100) / 100) }))} className="bg-muted p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent">-</button>
                                            <input type="number" step="0.01" value={orderForm.volume} onChange={(e) => setOrderForm({ ...orderForm, volume: Number(e.target.value) })}
                                                className="flex-1 bg-muted border border-border rounded-md p-2 text-center font-mono text-sm text-foreground outline-none" />
                                            <button onClick={() => setOrderForm(p => ({ ...p, volume: Math.round((p.volume + 0.1) * 100) / 100 }))} className="bg-muted p-2 rounded text-muted-foreground hover:text-foreground hover:bg-accent">+</button>
                                        </div>
                                    </div>

                                    {orderForm.type !== 'market' && (
                                        <div className="space-y-1">
                                            <label className="text-xs text-muted-foreground font-medium">Price</label>
                                            <input type="number" step="0.00001" value={orderForm.price} onChange={(e) => setOrderForm({ ...orderForm, price: e.target.value })}
                                                className="w-full bg-muted border border-border rounded-md p-2 font-mono text-sm text-foreground outline-none" />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs text-muted-foreground font-medium">Take Profit</label>
                                                {orderForm.tp && (
                                                    <button onClick={() => setOrderForm(p => ({ ...p, tp: '' }))} className="text-muted-foreground hover:text-foreground">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => adjustTP(-10)} className="bg-muted p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent text-xs">
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <input type="number" step={pipSize} placeholder="Optional" value={orderForm.tp}
                                                    onChange={(e) => setOrderForm({ ...orderForm, tp: e.target.value })}
                                                    className="flex-1 bg-muted border border-border rounded-md p-1.5 font-mono text-xs text-foreground outline-none text-center min-w-0" />
                                                <button onClick={() => adjustTP(10)} className="bg-muted p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent text-xs">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            {orderForm.tp && (
                                                <p className="text-[10px] font-mono text-[#00d4aa]">
                                                    est. +{calcEstPnL(Number(orderForm.tp), 'buy').toFixed(2)} USD
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs text-muted-foreground font-medium">Stop Loss</label>
                                                {orderForm.sl && (
                                                    <button onClick={() => setOrderForm(p => ({ ...p, sl: '' }))} className="text-muted-foreground hover:text-foreground">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => adjustSL(-10)} className="bg-muted p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent text-xs">
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <input type="number" step={pipSize} placeholder="Optional" value={orderForm.sl}
                                                    onChange={(e) => setOrderForm({ ...orderForm, sl: e.target.value })}
                                                    className="flex-1 bg-muted border border-border rounded-md p-1.5 font-mono text-xs text-foreground outline-none text-center min-w-0" />
                                                <button onClick={() => adjustSL(10)} className="bg-muted p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent text-xs">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            {orderForm.sl && (
                                                <p className="text-[10px] font-mono text-[#ff4444]">
                                                    est. {calcEstPnL(Number(orderForm.sl), 'sell').toFixed(2)} USD
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-4 grid grid-cols-2 gap-3 mt-4">
                                        <button
                                            onClick={() => submitOrder('buy')}
                                            disabled={orderSubmitting || connectionStatus !== 'connected'}
                                            className="w-full bg-[#00d4aa]/10 hover:bg-[#00d4aa]/20 border border-[#00d4aa]/30 text-[#00d4aa] py-3 rounded-lg font-bold text-sm transition-all flex flex-col items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                        >
                                            <span className="text-[10px] font-medium opacity-75">{orderForm.volume} lots</span>
                                            <span>{orderSubmitting ? '...' : `BUY ${orderForm.type.toUpperCase()}`}</span>
                                        </button>
                                        <button
                                            onClick={() => submitOrder('sell')}
                                            disabled={orderSubmitting || connectionStatus !== 'connected'}
                                            className="w-full bg-[#ff4444]/10 hover:bg-[#ff4444]/20 border border-[#ff4444]/30 text-[#ff4444] py-3 rounded-lg font-bold text-sm transition-all flex flex-col items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                                        >
                                            <span className="text-[10px] font-medium opacity-75">{orderForm.volume} lots</span>
                                            <span>{orderSubmitting ? '...' : `SELL ${orderForm.type.toUpperCase()}`}</span>
                                        </button>
                                    </div>
                                    {orderError && (
                                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                                            <p className="text-xs text-red-400">{orderError}</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'positions' && (
                                <motion.div
                                    key="positions"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-3"
                                >
                                    {openTrades.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                                            <Activity className="w-8 h-8 mb-2 opacity-50" />
                                            <p className="text-sm">No open positions</p>
                                        </div>
                                    ) : (
                                        openTrades.map(trade => {
                                            const t = trade;
                                            const side = t.side || (t.direction === 'long' ? 'buy' : 'sell');
                                            const vol = Number(t.volume ?? t.quantity);
                                            const entry = Number(t.entryPrice);
                                            // Compute floating P&L client-side from live price
                                            // so it updates at the displayPrice sync rate (200ms)
                                            const livePnl = displayPrice > 0 && entry > 0
                                                ? ((side === 'buy' ? displayPrice - entry : entry - displayPrice) * contractSize * vol)
                                                : (t.unrealizedPnL ?? 0);
                                            return (
                                            <div key={trade.id} className="bg-muted/50 border border-border rounded-lg p-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${side === 'buy' ? 'bg-[#00d4aa]/20 text-[#00d4aa]' : 'bg-[#ff4444]/20 text-[#ff4444]'}`}>
                                                            {side}
                                                        </span>
                                                        <span className="text-xs font-medium text-foreground">{vol} Lots</span>
                                                    </div>
                                                    <button onClick={() => closeTrade(trade.id, currentPriceRef.current)} className="text-xs font-bold text-muted-foreground hover:text-red-400 bg-muted hover:bg-accent px-2 py-1 rounded transition-colors">
                                                        Close
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div>
                                                        <span className="text-muted-foreground">Entry</span>
                                                        <p className="font-mono text-foreground">{entry.toFixed(priceDecimals)}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-muted-foreground">Floating P&L</span>
                                                        <p className={`font-mono font-bold ${livePnl >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4444]'}`}>
                                                            {livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)} USD
                                                        </p>
                                                    </div>
                                                </div>
                                                {(t.tp || t.takeProfit || t.sl || t.stopLoss) && (
                                                    <div className="grid grid-cols-2 gap-2 text-xs mt-2 pt-2 border-t border-border/50">
                                                        <div>
                                                            <span className="text-muted-foreground">TP</span>
                                                            <p className="font-mono text-[#00d4aa]">{Number(t.tp ?? t.takeProfit) > 0 ? Number(t.tp ?? t.takeProfit).toFixed(priceDecimals) : '—'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-muted-foreground">SL</span>
                                                            <p className="font-mono text-[#ff4444]">{Number(t.sl ?? t.stopLoss) > 0 ? Number(t.sl ?? t.stopLoss).toFixed(priceDecimals) : '—'}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            );
                                        })
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'history' && (
                                <motion.div
                                    key="history"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-2"
                                >
                                    {closedTrades.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                                            <Clock className="w-8 h-8 mb-2 opacity-50" />
                                            <p className="text-sm">No trade history yet</p>
                                        </div>
                                    ) : (
                                        closedTrades.map(t => {
                                            const entryD = t.entryDate ? new Date(t.entryDate) : null;
                                            const exitD = t.exitDate ? new Date(t.exitDate) : null;
                                            const pnl = Number(t.pnlNet) || 0;
                                            const isLong = t.direction === 'long';
                                            return (
                                                <div key={t.id} className="bg-muted/50 border border-border rounded-lg p-3 space-y-2">
                                                    {/* Header: direction + instrument + P&L */}
                                                    <div className="flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${isLong ? 'bg-[#00d4aa]/20 text-[#00d4aa]' : 'bg-[#ff4444]/20 text-[#ff4444]'}`}>
                                                                {isLong ? 'LONG' : 'SHORT'}
                                                            </span>
                                                            <span className="text-xs font-bold text-foreground">{t.symbol}</span>
                                                            <span className="text-[10px] text-muted-foreground">{t.quantity} lots</span>
                                                        </div>
                                                        <span className={`text-xs font-bold font-mono ${pnl >= 0 ? 'text-[#00d4aa]' : 'text-[#ff4444]'}`}>
                                                            {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    {/* Entry / Exit rows */}
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                                        <div>
                                                            <span className="text-muted-foreground">Entry Date</span>
                                                            <p className="font-mono text-foreground">{entryD ? entryD.toLocaleDateString() : '—'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Entry Time</span>
                                                            <p className="font-mono text-foreground">{entryD ? entryD.toLocaleTimeString() : '—'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Exit Date</span>
                                                            <p className="font-mono text-foreground">{exitD ? exitD.toLocaleDateString() : '—'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Exit Time</span>
                                                            <p className="font-mono text-foreground">{exitD ? exitD.toLocaleTimeString() : '—'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Entry Price</span>
                                                            <p className="font-mono text-foreground">{Number(t.entryPrice).toFixed(priceDecimals)}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">Exit Price</span>
                                                            <p className="font-mono text-foreground">{t.exitPrice != null ? Number(t.exitPrice).toFixed(priceDecimals) : '—'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Setup Detector Panel */}
            <SetupDetector
                open={detectorOpen}
                onClose={() => setDetectorOpen(false)}
                candles={initialCandles || []}
                symbol={session?.instrument || ''}
                timeframe={activeTimeframe || session?.timeframe || ''}
            />

            {/* Setup Validator Panel */}
            <SetupValidator
                open={validatorOpen}
                onClose={() => setValidatorOpen(false)}
                chartContainerRef={chartContainerRef}
                timeframe={activeTimeframe || session?.timeframe || ''}
            />
        </div>
    );
}
