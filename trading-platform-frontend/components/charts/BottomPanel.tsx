'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useMT5 } from '@/components/mt5/MT5Context';
import PerformancePanel from './PerformancePanel';

/** Activity log entry derived from real-time MT5 data */
interface LogEntry {
    id: string;
    timestamp: number;
    signal: 'BUY' | 'SELL' | 'CLOSE' | 'MODIFY';
    symbol: string;
    volume: number;
    price: number;
    profit?: number;
}

export default function BottomPanel() {
    const [activeTab, setActiveTab] = useState<'logs' | 'history' | 'performance'>('logs');
    const [panelHeight, setPanelHeight] = useState(240);
    const [collapsed, setCollapsed] = useState(true);
    const dragRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startHeight = useRef(240);

    // Resize handle
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = startY.current - e.clientY;
            setPanelHeight(Math.max(120, Math.min(600, startHeight.current + delta)));
        };
        const handleMouseUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Collapsed: just show the tab bar + toggle
    if (collapsed) {
        return (
            <div className="bg-card border-t border-border flex items-center px-2 h-8 shrink-0">
                <div className="flex flex-1">
                    {(['logs', 'history', 'performance'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setCollapsed(false); }}
                            className={`px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors ${activeTab === tab
                                ? 'text-indigo-400'
                                : 'text-muted-foreground hover:text-foreground/50'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setCollapsed(false)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Expand panel"
                >
                    <ChevronUp size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="bg-card border-t border-border flex flex-col shrink-0" style={{ height: panelHeight }}>
            {/* Resize handle */}
            <div
                ref={dragRef}
                className="h-1 cursor-ns-resize hover:bg-indigo-500/30 transition-colors flex items-center justify-center"
                onMouseDown={(e) => {
                    isDragging.current = true;
                    startY.current = e.clientY;
                    startHeight.current = panelHeight;
                }}
            >
                <div className="w-8 h-0.5 bg-border rounded-full" />
            </div>

            {/* Tab headers + collapse button */}
            <div className="flex items-center border-b border-border px-2">
                <div className="flex flex-1">
                    {(['logs', 'history', 'performance'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors ${activeTab === tab
                                ? 'text-indigo-400 border-b-2 border-indigo-400'
                                : 'text-muted-foreground hover:text-foreground/50'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                <button
                    onClick={() => setCollapsed(true)}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Collapse panel"
                >
                    <ChevronDown size={14} />
                </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="h-full"
                    >
                        {activeTab === 'logs' && <LogsTab />}
                        {activeTab === 'history' && <HistoryTab />}
                        {activeTab === 'performance' && <PerformancePanel />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// ─── Logs Tab (Real-time MT5 Activity) ──────────────────────────────────────

function LogsTab() {
    const mt5 = useMT5();
    const logsEndRef = useRef<HTMLDivElement>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const prevPositionTicketsRef = useRef<Set<number>>(new Set());

    // Build live logs from position changes and closed trades
    useEffect(() => {
        const currentTickets = new Set(mt5.positions.map(p => p.ticket));
        const prevTickets = prevPositionTicketsRef.current;

        const newLogs: LogEntry[] = [];

        // Detect new positions (opened)
        for (const pos of mt5.positions) {
            if (!prevTickets.has(pos.ticket)) {
                newLogs.push({
                    id: `open-${pos.ticket}-${Date.now()}`,
                    timestamp: Date.now(),
                    signal: pos.type_str,
                    symbol: pos.symbol,
                    volume: pos.volume,
                    price: pos.price_open,
                });
            }
        }

        // Detect closed positions (was in prev, not in current)
        for (const ticket of prevTickets) {
            if (!currentTickets.has(ticket)) {
                newLogs.push({
                    id: `close-${ticket}-${Date.now()}`,
                    timestamp: Date.now(),
                    signal: 'CLOSE',
                    symbol: '—',
                    volume: 0,
                    price: 0,
                });
            }
        }

        if (newLogs.length > 0) {
            setLogs(prev => [...newLogs, ...prev].slice(0, 200));
        }

        prevPositionTicketsRef.current = currentTickets;
    }, [mt5.positions]);

    // Also add logs from trade history (closed trades with full detail)
    useEffect(() => {
        if (mt5.tradeHistory.length === 0) return;
        const historyLogs: LogEntry[] = mt5.tradeHistory.slice(0, 20).map(t => ({
            id: `hist-${t.ticket_out}`,
            timestamp: t.exit_time * 1000,
            signal: 'CLOSE' as const,
            symbol: t.symbol,
            volume: t.volume,
            price: t.exit_price,
            profit: t.profit,
        }));
        setLogs(prev => {
            const existingIds = new Set(prev.map(l => l.id));
            const fresh = historyLogs.filter(l => !existingIds.has(l.id));
            if (fresh.length === 0) return prev;
            return [...fresh, ...prev].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
        });
    }, [mt5.tradeHistory]);

    // Poll for fresh data
    useEffect(() => {
        mt5.refreshPositions();
        mt5.refreshTradeHistory(7);
        const id = setInterval(() => {
            mt5.refreshPositions();
            mt5.refreshTradeHistory(7);
        }, 3000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Seed initial logs from current positions on mount
    useEffect(() => {
        if (mt5.positions.length > 0 && logs.length === 0) {
            const initial: LogEntry[] = mt5.positions.map(p => ({
                id: `init-${p.ticket}`,
                timestamp: p.time * 1000,
                signal: p.type_str,
                symbol: p.symbol,
                volume: p.volume,
                price: p.price_open,
                profit: p.profit,
            }));
            setLogs(initial.sort((a, b) => b.timestamp - a.timestamp));
            prevPositionTicketsRef.current = new Set(mt5.positions.map(p => p.ticket));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mt5.positions.length]);

    if (logs.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground font-mono">
                No activity yet — waiting for trades...
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-2 space-y-0.5">
            {logs.map((log) => (
                <div key={log.id} className="flex items-center gap-2 px-2 py-1 hover:bg-accent/30 rounded text-[10px] font-mono">
                    <span className="text-muted-foreground/60 w-20 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${log.signal === 'BUY' ? 'bg-emerald-500/15 text-emerald-400' :
                        log.signal === 'SELL' ? 'bg-red-500/15 text-red-400' :
                            log.signal === 'CLOSE' ? 'bg-amber-500/15 text-amber-400' :
                                'bg-blue-500/15 text-blue-400'
                        }`}>
                        {log.signal}
                    </span>
                    <span className="text-muted-foreground">{log.symbol}</span>
                    {log.volume > 0 && (
                        <span className="text-muted-foreground/50">{log.volume} lots</span>
                    )}
                    {log.price > 0 && (
                        <span className="text-muted-foreground/40">@ {log.price.toFixed(5)}</span>
                    )}
                    {log.profit !== undefined && (
                        <span className={`ml-auto font-semibold ${log.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {log.profit >= 0 ? '+' : ''}${log.profit.toFixed(2)}
                        </span>
                    )}
                    {log.profit === undefined && <span className="ml-auto" />}
                </div>
            ))}
            <div ref={logsEndRef} />
        </div>
    );
}

// ─── History Tab (Real-time MT5 Closed Trades) ──────────────────────────────

function HistoryTab() {
    const mt5 = useMT5();
    const history = mt5.tradeHistory;

    // Poll for fresh trade history
    useEffect(() => {
        mt5.refreshTradeHistory(30);
        const id = setInterval(() => mt5.refreshTradeHistory(30), 5000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (history.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground font-mono">
                No closed trades
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto">
            <table className="w-full text-[10px] font-mono">
                <thead className="sticky top-0 bg-card">
                    <tr className="text-muted-foreground border-b border-border">
                        <th className="text-left px-2 py-1">Symbol</th>
                        <th className="text-left px-2 py-1">Side</th>
                        <th className="text-right px-2 py-1">Volume</th>
                        <th className="text-right px-2 py-1">Entry</th>
                        <th className="text-right px-2 py-1">Exit</th>
                        <th className="text-right px-2 py-1">P&L</th>
                        <th className="text-right px-2 py-1">Duration</th>
                    </tr>
                </thead>
                <tbody>
                    {history.map((trade) => {
                        const durationMin = trade.exit_time > trade.entry_time
                            ? Math.round((trade.exit_time - trade.entry_time) / 60)
                            : 0;
                        const durationStr = durationMin >= 60
                            ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
                            : `${durationMin}m`;
                        const decimals = trade.symbol.includes('JPY') ? 3 : trade.symbol.startsWith('XAU') ? 2 : 5;
                        const totalPnl = trade.profit + trade.swap + trade.commission;

                        return (
                            <tr key={trade.ticket_out} className="text-muted-foreground hover:bg-accent/50 border-b border-border/30">
                                <td className="px-2 py-1.5">{trade.symbol}</td>
                                <td className="px-2 py-1.5">
                                    <span className={trade.type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                                        {trade.type}
                                    </span>
                                </td>
                                <td className="text-right px-2 py-1.5">{trade.volume}</td>
                                <td className="text-right px-2 py-1.5">{trade.entry_price.toFixed(decimals)}</td>
                                <td className="text-right px-2 py-1.5">{trade.exit_price.toFixed(decimals)}</td>
                                <td className={`text-right px-2 py-1.5 font-semibold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                                </td>
                                <td className="text-right px-2 py-1.5 text-muted-foreground/60">{durationStr}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
