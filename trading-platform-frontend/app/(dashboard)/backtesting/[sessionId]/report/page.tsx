'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { formatCurrency, formatNumber, formatPercent } from '@/lib/utils/formatters';
import { ArrowLeft, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

export default function BacktestReportPage() {
    const params = useParams();
    const sessionId = params.sessionId as string;

    const { data: report, isLoading } = useQuery({
        queryKey: ['backtest-report', sessionId],
        queryFn: async () => {
            const { data } = await api.get(`/backtesting/sessions/${sessionId}/report`);
            return data;
        }
    });

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Generating report...</p>
                </div>
            </div>
        );
    }

    const { stats, equityCurve, drawdown } = report || {};

    // Prepare chart data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartData = equityCurve?.map((d: any) => ({
        date: new Date(d.date).toLocaleDateString(),
        equity: d.equity,
    })) || [];

    return (
        <div className="space-y-8 pb-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href={`/backtesting/${sessionId}`}>
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Backtest Report</h1>
                    <p className="text-muted-foreground">Session Analysis and Performance Metrics</p>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net P&L</CardTitle>
                        <span className="font-bold text-muted-foreground">$</span>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatCurrency(stats.totalPnl)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Gross: {formatCurrency(stats.totalPnlGross)} | Fees: {formatCurrency(stats.totalFees)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatPercent(stats.winRate)}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.winningTrades} Wins / {stats.losingTrades} Losses
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatNumber(stats.profitFactor)}</div>
                        <p className="text-xs text-muted-foreground">
                            Exp: {formatCurrency(stats.expectancy)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                            {formatCurrency(drawdown.maxDrawdown)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {formatPercent(drawdown.maxDrawdownPercent)} Peak to Valley
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Equity Curve */}
            <div className="grid gap-4 md:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Equity Curve</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} padding={{ left: 10, right: 10 }} minTickGap={30} />
                                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} domain={['auto', 'auto']} />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                    formatter={(value: number | undefined) => [value !== undefined ? formatCurrency(value) : '', 'Equity']}
                                />
                                <Area type="monotone" dataKey="equity" stroke="#22c55e" fillOpacity={1} fill="url(#colorEquity)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Additional Stats */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Trade Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm text-muted-foreground">Total Trades</span>
                            <span className="font-bold">{stats.totalTrades}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm text-muted-foreground">Average Win</span>
                            <span className="font-bold text-green-500">{formatCurrency(stats.averageWin)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm text-muted-foreground">Average Loss</span>
                            <span className="font-bold text-red-500">{formatCurrency(stats.averageLoss)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm text-muted-foreground">Largest Win</span>
                            <span className="font-bold text-green-500">{formatCurrency(stats.largestWin)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm text-muted-foreground">Largest Loss</span>
                            <span className="font-bold text-red-500">{formatCurrency(stats.largestLoss)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-sm text-muted-foreground">Max Consecutive Wins</span>
                            <span className="font-bold">{stats.maxConsecutiveWins}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2">
                            <span className="text-sm text-muted-foreground">Max Consecutive Losses</span>
                            <span className="font-bold">{stats.maxConsecutiveLosses}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
