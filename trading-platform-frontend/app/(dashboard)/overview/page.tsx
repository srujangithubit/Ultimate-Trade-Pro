'use client';

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
