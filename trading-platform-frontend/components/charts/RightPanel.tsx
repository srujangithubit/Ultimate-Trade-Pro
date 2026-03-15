'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Bell, BellRing, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useTradingStore } from '@/lib/stores/tradingStore';
import { useMT5 } from '@/components/mt5/MT5Context';
import type { PriceAlert } from '@/lib/hooks/usePriceAlerts';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Position, Order, OrderSide, OrderType, RiskValidationResult } from '@/lib/types/trading';
import OrderPanel from './OrderPanel';

const SYMBOLS_LIST = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'US500', 'NAS100', 'EURGBP'];

export default function RightPanel({
    initialTab,
    onTabConsumed,
    alerts = [],
    onCreateAlert,
    onDeleteAlert,
}: {
    initialTab?: string;
    onTabConsumed?: () => void;
    alerts?: PriceAlert[];
    onCreateAlert?: (symbol: string, targetPrice: number, direction?: 'above' | 'below', note?: string) => Promise<PriceAlert>;
    onDeleteAlert?: (id: string) => Promise<void>;
} = {}) {
    const [activeTab, setActiveTab] = useState<'watchlist' | 'orders' | 'positions' | 'risk' | 'alerts'>('watchlist');
    const [collapsed, setCollapsed] = useState(true);

    // Auto-expand and switch to the requested tab
    useEffect(() => {
        if (initialTab === 'alerts' || initialTab === 'watchlist' || initialTab === 'orders' || initialTab === 'positions' || initialTab === 'risk') {
            setActiveTab(initialTab);
            setCollapsed(false);
            onTabConsumed?.();
        }
    }, [initialTab, onTabConsumed]);

    // Collapsed: show only a thin vertical strip with expand arrow
    if (collapsed) {
        return (
            <div className="relative h-full flex items-start">
                <button
                    onClick={() => setCollapsed(false)}
                    className="absolute -left-6 top-2 z-10 w-6 h-8 flex items-center justify-center bg-card border border-border border-r-0 rounded-l hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Expand panel"
                >
                    <ChevronLeft size={14} />
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-80 min-w-[320px] h-full bg-card border-l border-border flex flex-col"
        >
            {/* Tab headers + collapse button */}
            <div className="flex items-center border-b border-border">
                <button
                    onClick={() => setCollapsed(true)}
                    className="px-1.5 py-2 text-muted-foreground hover:text-foreground transition-colors"
                    title="Collapse panel"
                >
                    <ChevronRight size={14} />
                </button>
                {(['watchlist', 'orders', 'positions', 'risk', 'alerts'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors ${activeTab === tab
                            ? tab === 'alerts' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-indigo-400 border-b-2 border-indigo-400'
                            : 'text-muted-foreground hover:text-foreground/50'
                            }`}
                    >
                        {tab === 'alerts' ? <span className="flex items-center justify-center gap-1"><BellRing size={10} />Alerts</span> : tab}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 flex flex-col">
                {activeTab === 'watchlist' && <div className="flex-1 overflow-y-auto"><WatchlistTab /></div>}
                {activeTab === 'orders' && <OrderPanel />}
                {activeTab === 'positions' && <div className="flex-1 overflow-y-auto"><PositionsTab /></div>}
                {activeTab === 'risk' && <div className="flex-1 overflow-y-auto"><RiskTab /></div>}
                {activeTab === 'alerts' && <div className="flex-1 overflow-y-auto"><AlertsTab alerts={alerts} onCreateAlert={onCreateAlert} onDeleteAlert={onDeleteAlert} /></div>}
            </div>
        </motion.div>
    );
}

// ─── Watchlist Tab (Live MT5 Prices) ────────────────────────────────────────

function WatchlistTab() {
    const setSymbol = useTradingStore((s) => s.setSymbol);
    const activeSymbol = useTradingStore((s) => s.activeSymbol);
    const mt5 = useMT5();

    // Subscribe to all watchlist symbols
    useEffect(() => {
        SYMBOLS_LIST.forEach((s) => mt5.subscribe(s));
        return () => {
            SYMBOLS_LIST.forEach((s) => mt5.unsubscribe(s));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="p-1">
            {SYMBOLS_LIST.map((symbol) => {
                const tick = mt5.ticks[symbol];
                const hasTick = !!tick;
                const bid = tick?.bid;
                const ask = tick?.ask;
                const spread = bid && ask ? ((ask - bid) * (symbol === 'USDJPY' ? 100 : symbol === 'XAUUSD' ? 100 : 10000)).toFixed(1) : null;

                return (
                    <button
                        key={symbol}
                        onClick={() => setSymbol(symbol)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-mono transition-colors ${activeSymbol === symbol
                            ? 'bg-indigo-500/10 text-indigo-300'
                            : 'text-muted-foreground hover:bg-accent'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">{symbol}</span>
                            {hasTick && (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {hasTick ? (
                                <>
                                    <span className="text-muted-foreground">{bid?.toFixed(symbol === 'USDJPY' ? 3 : symbol === 'XAUUSD' ? 2 : 5)}</span>
                                    <span className="text-muted-foreground/60 text-[9px]">{spread}sp</span>
                                </>
                            ) : (
                                <>
                                    <span className="text-muted-foreground/60">—</span>
                                    <span className="text-muted-foreground/40 text-[9px]">—</span>
                                </>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Order Ticket ───────────────────────────────────────────────────────────

function OrderTicket() {
    const activeSymbol = useTradingStore((s) => s.activeSymbol);
    const [side, setSide] = useState<OrderSide>('buy');
    const [type, setType] = useState<OrderType>('market');
    const [volume, setVolume] = useState(0.01);
    const [price, setPrice] = useState('');
    const [sl, setSl] = useState('');
    const [tp, setTp] = useState('');
    const [error, setError] = useState<string | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const mutation = useMutation({
        mutationFn: async (order: { symbol: string; side: OrderSide; type: OrderType; volume: number; price?: number; sl?: number; tp?: number }) => {
            const res = await api.post<{ success: boolean; error?: string; validation?: RiskValidationResult }>('/charts/orders', order);
            return res.data;
        },
        onSuccess: (data) => {
            if (!data.success) {
                setError(data.error ?? 'Order rejected');
            } else {
                setError(null);
                setPrice('');
                setSl('');
                setTp('');
            }
        },
        onError: () => {
            setError('Failed to submit order');
        },
    });

    const handleSubmit = () => {
        setError(null);
        const order: Record<string, unknown> = {
            symbol: activeSymbol,
            side,
            type,
            volume,
        };
        if (type !== 'market' && price) order.price = parseFloat(price);
        if (sl) order.sl = parseFloat(sl);
        if (tp) order.tp = parseFloat(tp);

        mutation.mutate(order as Parameters<typeof mutation.mutate>[0]);
    };

    return (
        <div className="p-3 space-y-3">
            {/* Symbol display */}
            <div className="text-center text-sm font-mono font-bold text-foreground/80">{activeSymbol}</div>

            {/* Buy/Sell toggle */}
            <div className="grid grid-cols-2 gap-1">
                <button
                    onClick={() => setSide('buy')}
                    className={`py-2 text-xs font-mono font-bold rounded transition-colors ${side === 'buy'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'text-muted-foreground border border-border'
                        }`}
                >
                    BUY
                </button>
                <button
                    onClick={() => setSide('sell')}
                    className={`py-2 text-xs font-mono font-bold rounded transition-colors ${side === 'sell'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'text-muted-foreground border border-border'
                        }`}
                >
                    SELL
                </button>
            </div>

            {/* Order type */}
            <div className="grid grid-cols-3 gap-1">
                {(['market', 'limit', 'stop'] as OrderType[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`py-1.5 text-[10px] font-mono uppercase rounded transition-colors ${type === t
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : 'text-muted-foreground border border-border'
                            }`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Volume */}
            <div>
                <label className="text-[10px] text-muted-foreground font-mono block mb-1">Volume (lots)</label>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setVolume((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
                        className="px-2 py-1.5 text-xs bg-muted rounded border border-border text-muted-foreground hover:text-foreground"
                    >
                        −
                    </button>
                    <input
                        type="number"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value) || 0.01)}
                        step={0.01}
                        min={0.01}
                        className="flex-1 bg-muted text-foreground text-xs font-mono text-center px-2 py-1.5 rounded border border-border outline-none focus:border-indigo-500/50"
                    />
                    <button
                        onClick={() => setVolume((v) => +(v + 0.01).toFixed(2))}
                        className="px-2 py-1.5 text-xs bg-muted rounded border border-border text-muted-foreground hover:text-foreground"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Price (disabled for market) */}
            {type !== 'market' && (
                <div>
                    <label className="text-[10px] text-muted-foreground font-mono block mb-1">Price</label>
                    <input
                        type="text"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="Enter price"
                        className="w-full bg-muted text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border outline-none focus:border-indigo-500/50"
                    />
                </div>
            )}

            {/* SL / TP */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-red-400/60 font-mono block mb-1">Stop Loss</label>
                    <input
                        type="text"
                        value={sl}
                        onChange={(e) => setSl(e.target.value)}
                        placeholder="SL"
                        className="w-full bg-muted text-foreground text-xs font-mono px-2 py-1.5 rounded border border-red-500/20 outline-none focus:border-red-500/50"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-emerald-400/60 font-mono block mb-1">Take Profit</label>
                    <input
                        type="text"
                        value={tp}
                        onChange={(e) => setTp(e.target.value)}
                        placeholder="TP"
                        className="w-full bg-muted text-foreground text-xs font-mono px-2 py-1.5 rounded border border-emerald-500/20 outline-none focus:border-emerald-500/50"
                    />
                </div>
            </div>

            {/* Risk preview */}
            {sl && (
                <div className="text-[10px] font-mono text-muted-foreground bg-muted rounded p-2">
                    Risk: <span className="text-amber-400">${(volume * Math.abs(parseFloat(sl) || 0) * 10000 * 10 * 0.0001).toFixed(2)}</span>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="text-[10px] font-mono text-red-400 bg-red-500/10 rounded p-2">
                    {error}
                </div>
            )}

            {/* Submit */}
            <motion.button
                ref={buttonRef}
                onClick={handleSubmit}
                disabled={mutation.isPending}
                className={`w-full py-2.5 rounded text-xs font-mono font-bold transition-all ${side === 'buy'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                    } disabled:opacity-50`}
                animate={error ? { x: [0, -8, 8, -8, 8, 0] } : {}}
                transition={{ duration: 0.4 }}
            >
                {mutation.isPending ? 'SUBMITTING...' : `${side.toUpperCase()} ${activeSymbol}`}
            </motion.button>
        </div>
    );
}

// ─── Positions Tab ──────────────────────────────────────────────────────────

function PositionsTab() {
    const mt5 = useMT5();
    const positions = mt5.positions; // Real-time from WebSocket

    // Poll positions every 2s so P&L stays fresh
    useEffect(() => {
        mt5.refreshPositions();
        const id = setInterval(() => mt5.refreshPositions(), 2000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const closeMutation = useMutation({
        mutationFn: async (ticket: number) => {
            return mt5.closePosition(ticket);
        },
    });

    if (positions.length === 0) {
        return (
            <div className="flex items-center justify-center h-32 text-[10px] text-muted-foreground font-mono">
                No open positions
            </div>
        );
    }

    return (
        <div className="p-1 space-y-1">
            {positions.map((pos) => {
                const isBuy = pos.type_str === 'BUY';
                const pnl = pos.profit + pos.swap;

                return (
                    <div
                        key={pos.ticket}
                        className="flex items-center justify-between px-2 py-2 rounded bg-accent/30 hover:bg-accent/50 transition-colors"
                    >
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                                <span className={`text-[9px] font-mono font-bold px-1 rounded ${isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                                    }`}>
                                    {pos.type_str}
                                </span>
                                <span className="text-xs font-mono text-foreground/70">{pos.symbol}</span>
                                <span className="text-[9px] font-mono text-muted-foreground">{pos.volume}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-muted-foreground/60">
                                    Open: {pos.price_open.toFixed(pos.symbol.includes('JPY') ? 3 : pos.symbol.startsWith('XAU') ? 2 : 5)}
                                </span>
                                <span className="text-[9px] font-mono text-muted-foreground/40">
                                    Now: {pos.price_current.toFixed(pos.symbol.includes('JPY') ? 3 : pos.symbol.startsWith('XAU') ? 2 : 5)}
                                </span>
                            </div>
                            {(pos.sl > 0 || pos.tp > 0) && (
                                <div className="flex items-center gap-2">
                                    {pos.sl > 0 && (
                                        <span className="text-[8px] font-mono text-red-400/50">SL: {pos.sl.toFixed(2)}</span>
                                    )}
                                    {pos.tp > 0 && (
                                        <span className="text-[8px] font-mono text-emerald-400/50">TP: {pos.tp.toFixed(2)}</span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </span>
                            <button
                                onClick={() => closeMutation.mutate(pos.ticket)}
                                disabled={closeMutation.isPending}
                                className="text-[9px] font-mono text-red-400/50 hover:text-red-400 transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Risk Tab ───────────────────────────────────────────────────────────────

function RiskTab() {
    const { dailyDrawdown, maxRiskPerTrade, marginUsed, marginAvailable } = useTradingStore();

    const drawdownPercent = Math.min(dailyDrawdown * 100, 100);
    const marginPercent = marginUsed + marginAvailable > 0
        ? (marginUsed / (marginUsed + marginAvailable)) * 100
        : 0;

    return (
        <div className="p-3 space-y-4">
            {/* Daily Drawdown Gauge */}
            <div className="flex flex-col items-center">
                <span className="text-[10px] font-mono text-muted-foreground mb-2">Daily Drawdown</span>
                <svg width="100" height="60" viewBox="0 0 100 60">
                    <path
                        d="M 10 55 A 40 40 0 0 1 90 55"
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />
                    <path
                        d="M 10 55 A 40 40 0 0 1 90 55"
                        fill="none"
                        stroke={drawdownPercent > 80 ? '#ff4444' : drawdownPercent > 50 ? '#f59e0b' : '#00d4aa'}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={`${(drawdownPercent / 100) * 126} 126`}
                    />
                    <text x="50" y="48" textAnchor="middle" className="fill-foreground/80 text-xs font-mono">
                        {drawdownPercent.toFixed(1)}%
                    </text>
                </svg>
            </div>

            {/* Margin Used */}
            <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                    <span className="text-muted-foreground">Margin Used</span>
                    <span className="text-muted-foreground">${marginUsed.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-indigo-500/60 rounded-full transition-all"
                        style={{ width: `${Math.min(marginPercent, 100)}%` }}
                    />
                </div>
            </div>

            {/* Max Risk Per Trade */}
            <div>
                <label className="text-[10px] font-mono text-muted-foreground block mb-1">Max Risk Per Trade</label>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        value={(maxRiskPerTrade * 100).toFixed(1)}
                        readOnly
                        className="flex-1 bg-muted text-foreground text-xs font-mono text-center px-2 py-1.5 rounded border border-border"
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">%</span>
                </div>
            </div>

            {/* Margin Available */}
            <div className="text-center">
                <span className="text-[10px] text-muted-foreground font-mono">Available Margin</span>
                <div className="text-lg font-mono font-bold text-foreground/80 mt-1">
                    ${marginAvailable.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
            </div>
        </div>
    );
}

// ─── Alerts Tab ─────────────────────────────────────────────────────────────

function AlertsTab({ alerts, onCreateAlert, onDeleteAlert }: {
    alerts: PriceAlert[];
    onCreateAlert?: (symbol: string, targetPrice: number, direction?: 'above' | 'below', note?: string) => Promise<PriceAlert>;
    onDeleteAlert?: (id: string) => Promise<void>;
}) {
    const activeSymbol = useTradingStore((s) => s.activeSymbol);
    const [price, setPrice] = useState('');
    const [direction, setDirection] = useState<'above' | 'below'>('above');
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleCreate() {
        const numPrice = parseFloat(price);
        if (isNaN(numPrice) || numPrice <= 0) return;
        setSubmitting(true);
        try {
            await onCreateAlert?.(activeSymbol, numPrice, direction, note.trim() || undefined);
            setPrice('');
            setNote('');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="p-2 space-y-3">
            {/* Quick create */}
            <div className="space-y-2 p-2 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-1">
                    <Bell size={10} />
                    <span>New alert on <span className="text-foreground font-semibold">{activeSymbol}</span></span>
                </div>
                <div className="flex gap-1.5">
                    <input
                        type="number"
                        step="any"
                        placeholder="Price"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        className="flex-1 bg-muted text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border outline-none focus:border-indigo-500/50"
                    />
                    <select
                        value={direction}
                        onChange={(e) => setDirection(e.target.value as 'above' | 'below')}
                        className="bg-muted text-foreground text-[10px] font-mono px-1.5 py-1.5 rounded border border-border outline-none"
                    >
                        <option value="above">▲ Above</option>
                        <option value="below">▼ Below</option>
                    </select>
                </div>
                <input
                    placeholder="Note (optional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    className="w-full bg-muted text-foreground text-xs font-mono px-2 py-1.5 rounded border border-border outline-none focus:border-indigo-500/50"
                />
                <button
                    onClick={handleCreate}
                    disabled={!price || submitting}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-mono font-semibold rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 disabled:opacity-40 transition-colors"
                >
                    <Plus size={11} />
                    {submitting ? 'Creating...' : 'Set Alert'}
                </button>
            </div>

            {/* Active alerts */}
            {alerts.length === 0 ? (
                <div className="text-center py-6 text-[10px] text-muted-foreground font-mono">
                    No active alerts
                </div>
            ) : (
                <div className="space-y-1">
                    {alerts.map((alert) => (
                        <div
                            key={alert.id}
                            className="flex items-center justify-between px-2 py-1.5 rounded border border-border bg-background hover:bg-accent/50 transition-colors"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {alert.direction === 'above' ? (
                                    <TrendingUp size={12} className="text-green-500 shrink-0" />
                                ) : (
                                    <TrendingDown size={12} className="text-red-500 shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <div className="text-xs font-mono font-semibold truncate">
                                        {alert.symbol}{' '}
                                        <span className="text-muted-foreground font-normal">
                                            @ {alert.targetPrice}
                                        </span>
                                    </div>
                                    {alert.note && (
                                        <div className="text-[9px] text-muted-foreground truncate">
                                            {alert.note}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => onDeleteAlert?.(alert.id)}
                                className="shrink-0 p-1 text-muted-foreground hover:text-red-400 transition-colors"
                            >
                                <Trash2 size={11} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
