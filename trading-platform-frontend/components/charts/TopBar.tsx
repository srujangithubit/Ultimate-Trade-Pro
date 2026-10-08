'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTradingStore } from '@/lib/stores/tradingStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Bell } from 'lucide-react';
import type { Timeframe, SymbolConfig, ConnectionStatus } from '@/lib/types/trading';

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

interface TopBarProps {
    gridMode: '1x1' | '2x2';
    chartProvider: 'native' | 'tradingview';
    onGridModeToggle: () => void;
    onChartProviderToggle: () => void;
    connectionStatus: ConnectionStatus;
    latencyMs: number;
    onAlertClick?: () => void;
}

export default function TopBar({
    gridMode,
    chartProvider,
    onGridModeToggle,
    onChartProviderToggle,
    connectionStatus,
    latencyMs,
    onAlertClick,
}: TopBarProps) {
    const {
        activeSymbol,
        timeframe,
        replayActive,
        strategyEnabled,
        equity,
        balance,
        floatingPnL,
        setSymbol,
        setTimeframe,
        toggleReplay,
        toggleStrategy,
    } = useTradingStore();

    // Fetch symbols
    const { data: symbols } = useQuery<SymbolConfig[]>({
        queryKey: ['symbols'],
        queryFn: async () => {
            const res = await api.get<SymbolConfig[]>('/charts/symbols');
            return res.data;
        },
        staleTime: 60 * 60 * 1000,
    });

    // RAF-driven account metrics display
    const equityRef = useRef<HTMLSpanElement>(null);
    const balanceRef = useRef<HTMLSpanElement>(null);
    const pnlRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        let rafId: number;
        const update = () => {
            const state = useTradingStore.getState();
            if (equityRef.current) equityRef.current.textContent = `$${state.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            if (balanceRef.current) balanceRef.current.textContent = `$${state.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
            if (pnlRef.current) {
                const pnl = state.floatingPnL;
                pnlRef.current.textContent = `${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                pnlRef.current.className = `font-mono text-xs font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`;
            }
            rafId = requestAnimationFrame(update);
        };
        rafId = requestAnimationFrame(update);
        return () => cancelAnimationFrame(rafId);
    }, []);

    const latencyColor = latencyMs < 50 ? 'bg-emerald-500' : latencyMs < 150 ? 'bg-amber-500' : 'bg-red-500';

    return (
        <div className="h-12 min-h-[48px] flex items-center justify-between px-3 bg-card border-b border-border">
            {/* Left — Symbol + Timeframe */}
            <div className="flex items-center gap-3">
                <select
                    value={activeSymbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="bg-muted text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border outline-none focus:border-indigo-500/50 transition-colors"
                >
                    {(symbols ?? []).map((s) => (
                        <option key={s.symbol} value={s.symbol}>{s.displayName}</option>
                    ))}
                </select>

                <div className="flex rounded overflow-hidden border border-border">
                    {TIMEFRAMES.map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-2.5 py-1 text-[10px] font-mono font-semibold transition-all ${timeframe === tf
                                    ? 'bg-indigo-500/30 text-indigo-300 shadow-inner'
                                    : 'text-muted-foreground hover:text-foreground/60 hover:bg-accent'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={onChartProviderToggle}
                    title={chartProvider === 'native'
                        ? 'Switch to TradingView chart'
                        : 'Switch to native MT5 chart'}
                    className="rounded border border-border px-2.5 py-1 text-[10px] font-mono font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                    {chartProvider === 'native' ? 'TV' : 'MT5'}
                </button>
            </div>

            {/* Center — Replay + Strategy */}
            <div className="flex items-center gap-3">
                <button
                    onClick={toggleReplay}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-mono font-semibold border transition-all ${replayActive
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        }`}
                >
                    <motion.span
                        className={`h-1.5 w-1.5 rounded-full ${replayActive ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    />
                    {replayActive ? 'REPLAY' : 'LIVE'}
                </button>

                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono">Strategy</span>
                    <button
                        onClick={toggleStrategy}
                        className={`relative w-7 h-4 rounded-full transition-colors ${strategyEnabled ? 'bg-indigo-500' : 'bg-muted'
                            }`}
                    >
                        <motion.span
                            className="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow"
                            animate={{ x: strategyEnabled ? 12 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    </button>
                </div>
            </div>

            {/* Right — Account metrics + Grid toggle + Latency */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-[10px] font-mono">
                    <div>
                        <span className="text-muted-foreground">Equity </span>
                        <span ref={equityRef} className="text-foreground/80 font-semibold">$0.00</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Balance </span>
                        <span ref={balanceRef} className="text-foreground/80 font-semibold">$0.00</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">P&L </span>
                        <span ref={pnlRef} className="font-mono text-xs font-semibold text-muted-foreground">$0.00</span>
                    </div>
                </div>

                <button
                    onClick={onAlertClick}
                    className="px-2 py-1.5 text-muted-foreground hover:text-amber-400 border border-border rounded transition-colors"
                    title="Price Alerts"
                >
                    <Bell size={13} />
                </button>

                <button
                    onClick={onGridModeToggle}
                    className="px-2 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded transition-colors"
                >
                    {gridMode === '1x1' ? '2×2' : '1×1'}
                </button>

                <div className="flex items-center gap-1">
                    <motion.span
                        className={`h-2 w-2 rounded-full ${latencyColor}`}
                        animate={connectionStatus === 'connected' ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                    />
                    <span className="text-[9px] text-muted-foreground font-mono">{latencyMs}ms</span>
                </div>
            </div>
        </div>
    );
}
