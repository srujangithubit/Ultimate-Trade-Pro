'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DailyStats {
    date: string;
    value: number; // Net P&L
    tradeCount: number;
}

interface Stats {
    totalPnl: number;
    winningTrades: number;
    losingTrades: number;
    totalTrades: number;
    totalDays: number;
    averageWin: number;
    averageLoss: number;
    totalCommission: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
}

interface DailyCumulativePnLChartProps {
    dailyData: DailyStats[];
    stats: Stats;
}

export default function DailyCumulativePnLChart({ dailyData, stats }: DailyCumulativePnLChartProps) {
    // Calculate cumulative P&L
    let runningTotal = 0;
    const cumulativeData = dailyData.map(day => {
        runningTotal += day.value;
        return {
            ...day,
            cumulativePnl: runningTotal
        };
    });

    const isProfit = (stats.totalPnl || 0) >= 0;
    const avgDailyVolume = stats.totalDays > 0 ? (stats.totalTrades / stats.totalDays).toFixed(2) : '0';

    const todayStr = new Date().toISOString().split('T')[0];
    const todayStats = dailyData.find(d => d.date === todayStr);
    const todayPnl = todayStats ? todayStats.value : null;

    // Dynamic styles
    const themeColor = isProfit ? 'text-emerald-500' : 'text-red-500';
    // Using widely supported classes. Solid border, darker background for contrast.
    const cardBg = isProfit ? 'bg-emerald-950/20' : 'bg-red-950/20';
    const cardBorder = isProfit ? 'border-emerald-500' : 'border-red-500';

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-base font-medium flex items-center gap-2">
                            Daily NET Cumulative P&L
                            <Info className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                        <Badge variant="outline" className={`${isProfit ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'} border-0`}>
                            <div className={`w-2 h-2 rounded-full ${isProfit ? 'bg-green-500' : 'bg-red-500'} mr-1`} />
                            {isProfit ? 'Wins' : 'Losses'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full mt-4">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                            <AreaChart data={cumulativeData}>
                                <defs>
                                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--muted)" strokeOpacity={0.1} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(value) => formatDate(value)}
                                    stroke="var(--foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={30}
                                />
                                <YAxis
                                    stroke="var(--foreground)"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                Date
                                                            </span>
                                                            <span className="font-bold text-muted-foreground">
                                                                {formatDate(data.date)}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                Cum. P&L
                                                            </span>
                                                            <span className={`font-bold ${data.cumulativePnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                {formatCurrency(data.cumulativePnl)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="cumulativePnl"
                                    stroke={isProfit ? '#10b981' : '#ef4444'}
                                    fillOpacity={1}
                                    fill="url(#colorPnl)"
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Stats Grid matching the user's request */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className={`${cardBg} ${cardBorder} border`}>
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-400">Today's P&L</p>
                        <p className={`text-2xl font-bold ${todayPnl !== null ? (todayPnl >= 0 ? 'text-emerald-500' : 'text-red-500') : 'text-zinc-500'}`}>
                            {todayPnl !== null ? formatCurrency(todayPnl) : '--'}
                        </p>
                    </CardContent>
                </Card>
                <Card className={`${cardBg} ${cardBorder} border`}>
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-400">Total P&L</p>
                        <p className={`text-2xl font-bold ${themeColor}`}>
                            {formatCurrency(stats.totalPnl)}
                        </p>
                    </CardContent>
                </Card>
                <Card className={`${cardBg} ${cardBorder} border`}>
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-400">
                            {isProfit ? 'Winning Trades' : 'Losing Trades'}
                        </p>
                        <p className={`text-2xl font-bold ${themeColor}`}>
                            {isProfit ? stats.winningTrades : stats.losingTrades}
                        </p>
                    </CardContent>
                </Card>
                <Card className={`${cardBg} ${cardBorder} border`}>
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-400">Average Daily Volume</p>
                        <p className={`text-2xl font-bold ${themeColor}`}>{avgDailyVolume}</p>
                    </CardContent>
                </Card>
                <Card className={`${cardBg} ${cardBorder} border`}>
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-400">
                            {isProfit ? 'Average Winning Trade' : 'Average Losing Trade'}
                        </p>
                        <p className={`text-2xl font-bold ${themeColor}`}>
                            {formatCurrency(isProfit ? stats.averageWin : stats.averageLoss)}
                        </p>
                    </CardContent>
                </Card>
                <Card className={`${cardBg} ${cardBorder} border`}>
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-400">Total Commissions</p>
                        <p className={`text-2xl font-bold ${themeColor}`}>{stats.totalCommission ? formatCurrency(stats.totalCommission) : '-'}</p>
                    </CardContent>
                </Card>
                <Card className={`${cardBg} ${cardBorder} border`}>
                    <CardContent className="p-6">
                        <p className="text-sm font-medium text-zinc-400">
                            {isProfit ? 'Max Consecutive Wins' : 'Max Consecutive Loss'}
                        </p>
                        <p className={`text-2xl font-bold ${themeColor}`}>
                            {isProfit ? stats.maxConsecutiveWins : stats.maxConsecutiveLosses}
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
