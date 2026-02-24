/**
 * MT5Analytics — Live trading analytics computed from MT5 positions & trade history.
 * Mirrors the main Analytics page layout but uses MT5 WebSocket data.
 * Includes shareable trade cards for open and closed trades.
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
    TrendingUp,
    Target,
    Activity,
    BarChart3,
    Zap,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Share2,
    Percent,
    Scale,
    Trophy,
    Flame,
} from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useMT5 } from './MT5Context';
import MT5ShareableTradeCard, {
    type ShareableTrade,
} from './MT5ShareableTradeCard';
import type { MT5TradePosition, MT5ClosedTrade } from '@/lib/types/mt5';
import { motion } from 'framer-motion';

// ─── Helpers ───

function formatPrice(price: number): string {
    if (!price) return '—';
    return price >= 10 ? price.toFixed(2) : price.toFixed(5);
}

function getSession(unix: number): string {
    const h = new Date(unix * 1000).getUTCHours();
    if (h >= 0 && h < 8) return 'Asian';
    if (h >= 8 && h < 13) return 'London';
    if (h >= 13 && h < 21) return 'New York';
    return 'Asian';
}

function getWeekday(unix: number): string {
    return new Date(unix * 1000).toLocaleDateString(undefined, { weekday: 'short' });
}

// ─── Stats computation ───

interface MT5Stats {
    totalTrades: number;
    openTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnl: number;
    unrealizedPnl: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    profitFactor: number;
    avgRR: number;
    expectancy: number;
    totalSwap: number;
    totalCommission: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    symbolPerformance: { symbol: string; count: number; pnl: number; wins: number; losses: number }[];
    sessionPerformance: { session: string; netProfit: number; totalProfit: number; totalLoss: number; wins: number; losses: number; totalTrades: number; winRate: number }[];
    weekdayPerformance: { day: string; count: number; pnl: number; wins: number; losses: number }[];
    equityCurve: { date: string; equity: number }[];
    dailyPnl: { date: string; pnl: number }[];
    longStats: { trades: number; wins: number; pnl: number };
    shortStats: { trades: number; wins: number; pnl: number };
}

function computeStats(positions: MT5TradePosition[], history: MT5ClosedTrade[]): MT5Stats {
    const wins = history.filter(t => t.profit > 0);
    const losses = history.filter(t => t.profit < 0);

    const totalPnl = history.reduce((s, t) => s + t.profit, 0);
    const unrealizedPnl = positions.reduce((s, p) => s + p.profit, 0);
    const totalGrossProfit = wins.reduce((s, t) => s + t.profit, 0);
    const totalGrossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
    const profitFactor = totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : totalGrossProfit > 0 ? Infinity : 0;

    const averageWin = wins.length > 0 ? totalGrossProfit / wins.length : 0;
    const averageLoss = losses.length > 0 ? totalGrossLoss / losses.length : 0;
    const avgRR = averageLoss > 0 ? Math.round((averageWin / averageLoss) * 10) / 10 : 0;
    const winRate = history.length > 0 ? (wins.length / history.length) * 100 : 0;
    const expectancy = history.length > 0 ? totalPnl / history.length : 0;

    const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.profit)) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.profit)) : 0;

    const totalSwap = history.reduce((s, t) => s + t.swap, 0) + positions.reduce((s, p) => s + p.swap, 0);
    const totalCommission = history.reduce((s, t) => s + t.commission, 0);

    // Consecutive wins/losses
    let maxConsWins = 0, maxConsLosses = 0, curWins = 0, curLosses = 0;
    const sorted = [...history].sort((a, b) => a.exit_time - b.exit_time);
    for (const t of sorted) {
        if (t.profit > 0) { curWins++; curLosses = 0; maxConsWins = Math.max(maxConsWins, curWins); }
        else if (t.profit < 0) { curLosses++; curWins = 0; maxConsLosses = Math.max(maxConsLosses, curLosses); }
        else { curWins = 0; curLosses = 0; }
    }

    // Symbol performance
    const symbolMap = new Map<string, { count: number; pnl: number; wins: number; losses: number }>();
    for (const t of history) {
        const e = symbolMap.get(t.symbol) || { count: 0, pnl: 0, wins: 0, losses: 0 };
        e.count++;
        e.pnl += t.profit;
        if (t.profit > 0) e.wins++;
        if (t.profit < 0) e.losses++;
        symbolMap.set(t.symbol, e);
    }
    const symbolPerformance = Array.from(symbolMap.entries()).map(([symbol, v]) => ({ symbol, ...v })).sort((a, b) => b.pnl - a.pnl);

    // Session performance
    const sessionMap = new Map<string, { netProfit: number; totalProfit: number; totalLoss: number; wins: number; losses: number; totalTrades: number }>();
    for (const t of history) {
        const session = getSession(t.entry_time);
        const e = sessionMap.get(session) || { netProfit: 0, totalProfit: 0, totalLoss: 0, wins: 0, losses: 0, totalTrades: 0 };
        e.totalTrades++;
        e.netProfit += t.profit;
        if (t.profit > 0) { e.totalProfit += t.profit; e.wins++; }
        if (t.profit < 0) { e.totalLoss += Math.abs(t.profit); e.losses++; }
        sessionMap.set(session, e);
    }
    const sessionPerformance = Array.from(sessionMap.entries()).map(([session, v]) => ({
        session,
        ...v,
        winRate: v.totalTrades > 0 ? Math.round((v.wins / v.totalTrades) * 100) : 0,
    }));

    // Weekday performance
    const weekdayMap = new Map<string, { count: number; pnl: number; wins: number; losses: number }>();
    for (const t of history) {
        const day = getWeekday(t.exit_time);
        const e = weekdayMap.get(day) || { count: 0, pnl: 0, wins: 0, losses: 0 };
        e.count++;
        e.pnl += t.profit;
        if (t.profit > 0) e.wins++;
        if (t.profit < 0) e.losses++;
        weekdayMap.set(day, e);
    }
    const weekdayPerformance = Array.from(weekdayMap.entries()).map(([day, v]) => ({ day, ...v }));

    // Daily PnL & equity curve
    const dailyMap = new Map<string, number>();
    for (const t of sorted) {
        const dateStr = new Date(t.exit_time * 1000).toLocaleDateString();
        dailyMap.set(dateStr, (dailyMap.get(dateStr) || 0) + t.profit);
    }
    const dailyPnl = Array.from(dailyMap.entries()).map(([date, pnl]) => ({ date, pnl }));
    let cumPnl = 0;
    const equityCurve = dailyPnl.map(d => {
        cumPnl += d.pnl;
        return { date: d.date, equity: Math.round(cumPnl * 100) / 100 };
    });

    // Long/Short
    const longs = history.filter(t => t.type === 'BUY');
    const shorts = history.filter(t => t.type === 'SELL');
    const longStats = { trades: longs.length, wins: longs.filter(t => t.profit > 0).length, pnl: longs.reduce((s, t) => s + t.profit, 0) };
    const shortStats = { trades: shorts.length, wins: shorts.filter(t => t.profit > 0).length, pnl: shorts.reduce((s, t) => s + t.profit, 0) };

    return {
        totalTrades: history.length,
        openTrades: positions.length,
        winningTrades: wins.length,
        losingTrades: losses.length,
        winRate: Math.round(winRate * 10) / 10,
        totalPnl,
        unrealizedPnl,
        averageWin,
        averageLoss,
        largestWin,
        largestLoss,
        profitFactor: Math.round(profitFactor * 100) / 100,
        avgRR,
        expectancy: Math.round(expectancy * 100) / 100,
        totalSwap,
        totalCommission,
        maxConsecutiveWins: maxConsWins,
        maxConsecutiveLosses: maxConsLosses,
        symbolPerformance,
        sessionPerformance,
        weekdayPerformance,
        equityCurve,
        dailyPnl,
        longStats,
        shortStats,
    };
}

// ─── Stat Card helper ───

function StatCard({ icon: Icon, label, value, color, subtext }: {
    icon: React.ElementType;
    label: string;
    value: string;
    color: string;
    subtext?: string;
}) {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 pb-4 px-4">
                <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="text-lg font-bold truncate">{value}</p>
                        {subtext && <p className="text-[11px] text-muted-foreground mt-0.5">{subtext}</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Main Component ───

export default function MT5Analytics() {
    const { positions, tradeHistory, account, status } = useMT5();
    const [shareCard, setShareCard] = useState<ShareableTrade | null>(null);

    const stats = useMemo(() => computeStats(positions, tradeHistory), [positions, tradeHistory]);

    if (!status.authenticated) {
        return (
            <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
                    <h3 className="text-lg font-semibold">Connect to View Analytics</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Analytics will be computed from your live trading data once connected.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const handleShareOpen = (pos: MT5TradePosition) => {
        setShareCard({
            kind: 'open',
            ticket: pos.ticket,
            symbol: pos.symbol,
            type: pos.type_str,
            volume: pos.volume,
            priceOpen: pos.price_open,
            priceCurrent: pos.price_current,
            profit: pos.profit,
            swap: pos.swap,
            sl: pos.sl,
            tp: pos.tp,
            openTime: pos.time,
            accountName: account?.name,
        });
    };

    const handleShareClosed = (t: MT5ClosedTrade) => {
        setShareCard({
            kind: 'closed',
            ticketIn: t.ticket_in,
            ticketOut: t.ticket_out,
            symbol: t.symbol,
            type: t.type,
            volume: t.volume,
            entryPrice: t.entry_price,
            exitPrice: t.exit_price,
            profit: t.profit,
            swap: t.swap,
            commission: t.commission,
            entryTime: t.entry_time,
            exitTime: t.exit_time,
            accountName: account?.name,
        });
    };

    return (
        <div className="space-y-6">
            {/* ── Overview Stats Grid ── */}
            <motion.div
                className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                initial="hidden"
                animate="show"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }}
            >
                {[
                    { icon: DollarSign, label: 'Total P&L', value: `${stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}`, color: stats.totalPnl >= 0 ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500', subtext: `${stats.totalTrades} closed trades` },
                    { icon: TrendingUp, label: 'Unrealized P&L', value: `${stats.unrealizedPnl >= 0 ? '+' : ''}${stats.unrealizedPnl.toFixed(2)}`, color: stats.unrealizedPnl >= 0 ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500', subtext: `${stats.openTrades} open positions` },
                    { icon: Target, label: 'Win Rate', value: `${stats.winRate}%`, color: 'bg-blue-500/15 text-blue-500', subtext: `${stats.winningTrades}W / ${stats.losingTrades}L` },
                    { icon: Activity, label: 'Profit Factor', value: stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2), color: 'bg-purple-500/15 text-purple-500' },
                    { icon: Zap, label: 'Avg R:R', value: `${stats.avgRR}:1`, color: 'bg-amber-500/15 text-amber-500' },
                    { icon: Scale, label: 'Expectancy', value: `${stats.expectancy >= 0 ? '+' : ''}${stats.expectancy.toFixed(2)}`, color: stats.expectancy >= 0 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-red-500/15 text-red-500', subtext: 'per trade' },
                    { icon: Trophy, label: 'Largest Win', value: `+${stats.largestWin.toFixed(2)}`, color: 'bg-green-500/15 text-green-500' },
                    { icon: Flame, label: 'Largest Loss', value: stats.largestLoss.toFixed(2), color: 'bg-red-500/15 text-red-500' },
                    { icon: ArrowUpRight, label: 'Max Win Streak', value: `${stats.maxConsecutiveWins}`, color: 'bg-green-500/15 text-green-500' },
                    { icon: ArrowDownRight, label: 'Max Loss Streak', value: `${stats.maxConsecutiveLosses}`, color: 'bg-red-500/15 text-red-500' },
                ].map((s, i) => (
                    <motion.div key={i} variants={{ hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0 } }}>
                        <StatCard {...s} />
                    </motion.div>
                ))}
            </motion.div>

            {/* ── Equity Curve & Long/Short ── */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Equity Curve */}
                <Card className="lg:col-span-2 hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">P&L Equity Curve</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.equityCurve.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No closed trades yet</p>
                        ) : (
                            <div className="h-70">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.equityCurve}>
                                        <defs>
                                            <linearGradient id="mt5EqFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23,23,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#e5e7eb' }} />
                                        <Area type="monotone" dataKey="equity" stroke="#22c55e" fill="url(#mt5EqFill)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Long vs Short */}
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Long vs Short</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="h-45">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Long', value: stats.longStats.trades },
                                            { name: 'Short', value: stats.shortStats.trades },
                                        ]}
                                        cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        <Cell fill="#22c55e" />
                                        <Cell fill="#ef4444" />
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(23,23,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#e5e7eb' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-2.5 text-center">
                                <p className="text-xs text-muted-foreground">Long</p>
                                <p className="text-sm font-bold">{stats.longStats.trades} trades</p>
                                <p className="text-xs text-muted-foreground">
                                    {stats.longStats.trades > 0 ? Math.round((stats.longStats.wins / stats.longStats.trades) * 100) : 0}% win
                                </p>
                                <p className={`text-xs font-semibold ${stats.longStats.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {stats.longStats.pnl >= 0 ? '+' : ''}{stats.longStats.pnl.toFixed(2)}
                                </p>
                            </div>
                            <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2.5 text-center">
                                <p className="text-xs text-muted-foreground">Short</p>
                                <p className="text-sm font-bold">{stats.shortStats.trades} trades</p>
                                <p className="text-xs text-muted-foreground">
                                    {stats.shortStats.trades > 0 ? Math.round((stats.shortStats.wins / stats.shortStats.trades) * 100) : 0}% win
                                </p>
                                <p className={`text-xs font-semibold ${stats.shortStats.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {stats.shortStats.pnl >= 0 ? '+' : ''}{stats.shortStats.pnl.toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Win/Loss Pie + Daily PnL Bar ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Win/Loss Distribution */}
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Win / Loss Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-65">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Wins', value: stats.winningTrades },
                                            { name: 'Losses', value: stats.losingTrades },
                                        ]}
                                        cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value"
                                        label={({ name, value }) => `${name}: ${value}`}
                                    >
                                        <Cell fill="#22c55e" />
                                        <Cell fill="#ef4444" />
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(23,23,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#e5e7eb' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Daily PnL Bar Chart */}
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Daily P&L</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.dailyPnl.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                        ) : (
                            <div className="h-65">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.dailyPnl}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23,23,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#e5e7eb' }} />
                                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                            {stats.dailyPnl.map((d, i) => (
                                                <Cell key={i} fill={d.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Symbol Performance ── */}
            {stats.symbolPerformance.length > 0 && (
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Performance by Symbol</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="h-62.5">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.symbolPerformance} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b7280' }} />
                                        <YAxis type="category" dataKey="symbol" tick={{ fontSize: 11, fill: '#6b7280' }} width={80} />
                                        <Tooltip contentStyle={{ backgroundColor: 'rgba(23,23,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#e5e7eb' }} />
                                        <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                                            {stats.symbolPerformance.map((s, i) => (
                                                <Cell key={i} fill={s.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Symbol</TableHead>
                                        <TableHead className="text-right">Trades</TableHead>
                                        <TableHead className="text-right">Win Rate</TableHead>
                                        <TableHead className="text-right">P&L</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stats.symbolPerformance.map((s) => (
                                        <TableRow key={s.symbol}>
                                            <TableCell className="font-medium">{s.symbol}</TableCell>
                                            <TableCell className="text-right">{s.count}</TableCell>
                                            <TableCell className="text-right">{s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0}%</TableCell>
                                            <TableCell className={`text-right font-semibold ${s.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {s.pnl >= 0 ? '+' : ''}{s.pnl.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Session Performance ── */}
            {stats.sessionPerformance.length > 0 && (
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Performance by Session</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Session</TableHead>
                                    <TableHead className="text-right">Trades</TableHead>
                                    <TableHead className="text-right">Wins</TableHead>
                                    <TableHead className="text-right">Losses</TableHead>
                                    <TableHead className="text-right">Win Rate</TableHead>
                                    <TableHead className="text-right">Net P&L</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.sessionPerformance.map((s) => (
                                    <TableRow key={s.session}>
                                        <TableCell className="font-medium">{s.session}</TableCell>
                                        <TableCell className="text-right">{s.totalTrades}</TableCell>
                                        <TableCell className="text-right text-green-500">{s.wins}</TableCell>
                                        <TableCell className="text-right text-red-500">{s.losses}</TableCell>
                                        <TableCell className="text-right">{s.winRate}%</TableCell>
                                        <TableCell className={`text-right font-semibold ${s.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {s.netProfit >= 0 ? '+' : ''}{s.netProfit.toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* ── Weekday Performance ── */}
            {stats.weekdayPerformance.length > 0 && (
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Performance by Day of Week</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-55">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.weekdayPerformance}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6b7280' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(23,23,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#e5e7eb' }} />
                                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                        {stats.weekdayPerformance.map((d, i) => (
                                            <Cell key={i} fill={d.pnl >= 0 ? '#22c55e' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Costs Summary ── */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                <StatCard icon={DollarSign} label="Total Swap" value={stats.totalSwap.toFixed(2)} color="bg-amber-500/15 text-amber-500" />
                <StatCard icon={DollarSign} label="Total Commission" value={stats.totalCommission.toFixed(2)} color="bg-orange-500/15 text-orange-500" />
                <StatCard icon={Percent} label="Avg Win" value={`+${stats.averageWin.toFixed(2)}`} color="bg-green-500/15 text-green-500" subtext={`Avg Loss: ${stats.averageLoss.toFixed(2)}`} />
            </div>

            {/* ── Shareable Trade Cards: Open Positions ── */}
            {positions.length > 0 && (
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Share2 className="h-4 w-4" /> Open Positions — Shareable
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {positions.map((pos) => {
                                const isBuy = pos.type_str === 'BUY';
                                const isProfit = pos.profit >= 0;
                                return (
                                    <div key={pos.ticket} className="rounded-xl border p-3 space-y-2 hover:bg-accent/30 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-7 w-7 flex items-center justify-center rounded-lg ${isBuy ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
                                                    {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">{pos.symbol}</p>
                                                    <p className="text-[10px] text-muted-foreground">{pos.type_str} • {pos.volume} lots</p>
                                                </div>
                                            </div>
                                            <p className={`text-sm font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                                {isProfit ? '+' : ''}{pos.profit.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{formatPrice(pos.price_open)} → {formatPrice(pos.price_current)}</span>
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => handleShareOpen(pos)}>
                                                <Share2 className="h-3 w-3" /> Share
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Shareable Trade Cards: Recent Closed Trades ── */}
            {tradeHistory.length > 0 && (
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Share2 className="h-4 w-4" /> Recent Closed Trades — Shareable
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {tradeHistory.slice(0, 12).map((t) => {
                                const isBuy = t.type === 'BUY';
                                const isProfit = t.profit >= 0;
                                return (
                                    <div key={`${t.ticket_in}-${t.ticket_out}`} className="rounded-xl border p-3 space-y-2 hover:bg-accent/30 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-7 w-7 flex items-center justify-center rounded-lg ${isBuy ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'}`}>
                                                    {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold">{t.symbol}</p>
                                                    <p className="text-[10px] text-muted-foreground">{t.type} • {t.volume} lots</p>
                                                </div>
                                            </div>
                                            <p className={`text-sm font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                                {isProfit ? '+' : ''}{t.profit.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                                            <span>{formatPrice(t.entry_price)} → {formatPrice(t.exit_price)}</span>
                                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => handleShareClosed(t)}>
                                                <Share2 className="h-3 w-3" /> Share
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Share Dialog ── */}
            <MT5ShareableTradeCard
                trade={shareCard}
                open={shareCard !== null}
                onClose={() => setShareCard(null)}
            />
        </div>
    );
}
