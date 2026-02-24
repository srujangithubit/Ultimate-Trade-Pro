'use client';

import { useEffect } from 'react';
import {
    TrendingUp,
    TrendingDown,
    Target,
    Activity,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    BarChart3,
    PlayCircle,
    BookOpen,
    Wifi,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatPercent, formatDate, getPnLColor } from '@/lib/utils/formatters';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import ForexSessionIndicator from '@/components/overview/ForexSessionIndicator';
import { useMT5 } from '@/components/mt5/MT5Context';

// Define Trade interface locally valid for now
interface Trade {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    exitPrice?: number;
    quantity: number;
    setup: string;
    entryDate: string;
    exitDate?: string;
    pnl?: number;
    pnlNet?: number;
    pnlGross?: number;
    pnlPercent?: number;
    fees?: number;
    commission?: number;
    tags: string[];
    notes?: string;
    status: string;
}

export default function OverviewPage() {
    const { positions, status: mt5Status, account: mt5Account, refreshPositions } = useMT5();

    // Keep positions updated in real time (same interval as Live Trading tab)
    useEffect(() => {
        if (mt5Status.authenticated) {
            refreshPositions();
            const interval = setInterval(refreshPositions, 5000);
            return () => clearInterval(interval);
        }
    }, [mt5Status.authenticated, refreshPositions]);

    const { data: stats, isLoading: isStatsLoading } = useQuery({
        queryKey: ['analytics-overview'],
        queryFn: async () => {
            const { data } = await api.get('/analytics/overview');
            return data;
        }
    });

    const { data: trades = [], isLoading: isTradesLoading } = useQuery({
        queryKey: ['trades'],
        queryFn: async () => {
            // Fetch trades - backend returns { trades, total, page, totalPages }
            const { data } = await api.get<{ trades: Trade[]; total: number }>('/trades');
            const list = Array.isArray(data) ? data : (data?.trades || []);
            return list;
        }
    });

    // Use backend stats
    const overview = stats || {
        totalPnl: 0,
        winRate: 0,
        profitFactor: 0,
        averageRR: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        largestWin: 0,
        largestLoss: 0,
    };

    const statsCards = [
        {
            title: 'Total P&L',
            value: formatCurrency(overview.totalPnl),
            change: '-', // Needs historical comparison
            positive: overview.totalPnl >= 0,
            icon: TrendingUp,
        },
        {
            title: 'Win Rate',
            value: `${(overview.winRate || 0).toFixed(1)}%`,
            change: `${overview.winningTrades}/${overview.totalTrades} trades`,
            positive: (overview.winRate || 0) > 50,
            icon: Target,
        },
        {
            title: 'Total Trades',
            value: (overview.totalTrades || 0).toString(),
            change: 'All time',
            positive: true,
            icon: Activity,
        },
        {
            title: 'Profit Factor',
            value: (overview.profitFactor || 0).toFixed(2),
            change: `Avg Win: ${formatCurrency(overview.averageWin || 0)}`,
            positive: (overview.profitFactor || 0) > 1.5,
            icon: Zap,
        },
    ];

    const bestTrade = overview.largestWin || 0;
    const worstTrade = overview.largestLoss || 0;
    const maxDrawdown = 0; // Still mocked until we pull drawdown stats

    const recentTrades = [...trades].sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()).slice(0, 5);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-muted-foreground">
                        Welcome back! Here&apos;s your trading overview.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Link href="/backtesting">
                        <Button className="gap-2">
                            <PlayCircle className="h-4 w-4" />
                            New Backtest
                        </Button>
                    </Link>
                    <Link href="/journal">
                        <Button variant="outline" className="gap-2">
                            <BookOpen className="h-4 w-4" />
                            Log Trade
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Forex Session Indicator */}
            <ForexSessionIndicator />

            {/* Stats cards */}
            <motion.div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                initial="hidden"
                animate="show"
                variants={{
                    hidden: { opacity: 0 },
                    show: {
                        opacity: 1,
                        transition: { staggerChildren: 0.1 }
                    }
                }}
            >
                {statsCards.map((stat) => (
                    <motion.div
                        key={stat.title}
                        variants={{
                            hidden: { opacity: 0, y: 20 },
                            show: { opacity: 1, y: 0 }
                        }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    >
                        <Card className="card-hover h-full">
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                                        <p className={`text-2xl font-bold ${stat.positive ? 'text-profit' : 'text-loss'}`}>
                                            {stat.value}
                                        </p>
                                    </div>
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.positive ? 'bg-profit' : 'bg-loss'}`}>
                                        <stat.icon className={`h-6 w-6 ${stat.positive ? 'text-profit' : 'text-loss'}`} style={{ filter: 'brightness(0.8)' }} />
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center gap-1 text-xs">
                                    {stat.positive ? (
                                        <ArrowUpRight className="h-3 w-3 text-profit" />
                                    ) : (
                                        <ArrowDownRight className="h-3 w-3 text-loss" />
                                    )}
                                    <span className="text-muted-foreground">{stat.change}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                ))}
            </motion.div>

            {/* Quick stats row */}
            <motion.div
                className="grid gap-4 sm:grid-cols-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <motion.div whileHover={{ y: -2 }}>
                    <Card>
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                <TrendingUp className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Best Trade</p>
                                <p className="text-lg font-semibold text-profit">
                                    {formatCurrency(bestTrade)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div whileHover={{ y: -2 }}>
                    <Card>
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                                <TrendingDown className="h-5 w-5 text-destructive" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Worst Trade</p>
                                <p className="text-lg font-semibold text-loss">
                                    {formatCurrency(worstTrade)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div whileHover={{ y: -2 }}>
                    <Card>
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                                <BarChart3 className="h-5 w-5 text-warning" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Max Drawdown</p>
                                <p className="text-lg font-semibold text-loss">
                                    {formatPercent(maxDrawdown)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>

            {/* Live Open Positions — only visible when MT5 is connected and has open positions */}
            {mt5Status.authenticated && positions.length > 0 && (() => {
                const totalUnrealized = positions.reduce((s, p) => s + p.profit, 0);
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                    >
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                                        <Wifi className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base">Live Open Positions</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {mt5Account?.name ? `${mt5Account.name} · ` : ''}
                                            {positions.length} position{positions.length !== 1 ? 's' : ''} · Unrealized P&L:{' '}
                                            <span className={totalUnrealized >= 0 ? 'text-green-500 font-semibold' : 'text-red-500 font-semibold'}>
                                                {totalUnrealized >= 0 ? '+' : ''}{totalUnrealized.toFixed(2)}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <Link href="/accounts">
                                    <Button variant="ghost" size="sm">View all</Button>
                                </Link>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {positions.map((pos) => {
                                        const isBuy = pos.type_str === 'BUY';
                                        const isProfit = pos.profit >= 0;
                                        const priceFmt = (p: number) => !p ? '—' : p >= 10 ? p.toFixed(2) : p.toFixed(5);
                                        return (
                                            <div
                                                key={pos.ticket}
                                                className="rounded-xl border p-3 space-y-2 hover:bg-accent/30 transition-colors"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`h-7 w-7 flex items-center justify-center rounded-lg ${
                                                            isBuy ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'
                                                        }`}>
                                                            {isBuy ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-semibold">{pos.symbol}</p>
                                                            <p className="text-[10px] text-muted-foreground">{pos.type_str} · {pos.volume} lots</p>
                                                        </div>
                                                    </div>
                                                    <p className={`text-sm font-bold ${isProfit ? 'text-green-500' : 'text-red-500'}`}>
                                                        {isProfit ? '+' : ''}{pos.profit.toFixed(2)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                    <span>{priceFmt(pos.price_open)} → {priceFmt(pos.price_current)}</span>
                                                    <div className="flex gap-2">
                                                        {pos.sl ? <span>SL: {priceFmt(pos.sl)}</span> : null}
                                                        {pos.tp ? <span>TP: {priceFmt(pos.tp)}</span> : null}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                );
            })()}

            {/* Recent trades */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Recent Trades</CardTitle>
                        <Link href="/journal">
                            <Button variant="ghost" size="sm">
                                View all
                            </Button>
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Symbol</TableHead>
                                    <TableHead>Direction</TableHead>
                                    <TableHead>Setup</TableHead>
                                    <TableHead className="text-right">Entry</TableHead>
                                    <TableHead className="text-right">Exit</TableHead>
                                    <TableHead className="text-right">P&L</TableHead>
                                    <TableHead className="text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isTradesLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            Loading trades...
                                        </TableCell>
                                    </TableRow>
                                ) : recentTrades.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No trades yet.
                                        </TableCell>
                                    </TableRow>
                                ) : recentTrades.map((trade) => (
                                    <TableRow key={trade.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                                        <TableCell className="font-semibold">{trade.symbol}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={trade.direction.toUpperCase() === 'LONG' ? 'default' : 'secondary'}
                                                className={trade.direction.toUpperCase() === 'LONG' ? 'bg-profit text-white' : 'bg-loss text-white'}
                                            >
                                                {trade.direction.toUpperCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{trade.setup}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {formatCurrency(trade.entryPrice)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}
                                        </TableCell>
                                        <TableCell className={`text-right font-semibold font-mono ${getPnLColor(trade.pnlNet ?? trade.pnl ?? 0)}`}>
                                            {(trade.pnlNet ?? trade.pnl) != null && (trade.pnlNet ?? trade.pnl)! >= 0 ? '+' : ''}{(trade.pnlNet ?? trade.pnl) != null ? formatCurrency(trade.pnlNet ?? trade.pnl ?? 0) : '-'}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {formatDate(trade.entryDate)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
