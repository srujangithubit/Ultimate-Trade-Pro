'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatters';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

interface AnalysisStats {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    bestWin: number;
    worstLoss: number;
    averageWin: number;
    averageLoss: number;
    avgWinDuration: number;
    avgLossDuration: number;
    avgWinStreak: number;
    avgLossStreak: number;
    maxWinStreak: number;
    maxLossStreak: number;
}

interface LongShortAnalysisProps {
    data: {
        all: AnalysisStats;
        long: AnalysisStats;
        short: AnalysisStats;
    };
}

const StatRow = ({ label, value, isCurrency = false, isDuration = false }: { label: string; value: number | undefined; isCurrency?: boolean; isDuration?: boolean }) => {
    const safeValue = value || 0;
    let formattedValue = safeValue.toString();

    if (isCurrency) {
        formattedValue = formatCurrency(value);
    } else if (isDuration) {
        // Convert minutes to readable format (e.g. 1h 49m 6s)
        const totalSeconds = Math.round(value * 60);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        const parts = [];
        if (h > 0) parts.push(`${h}h`);
        if (m > 0 || h > 0) parts.push(`${m}m`);
        parts.push(`${s}s`);
        formattedValue = parts.join(' ');
        if (!formattedValue) formattedValue = "0s";
    } else {
        formattedValue = safeValue.toFixed(2);
    }

    return (
        <div className="flex justify-between py-3 border-b border-border/50 last:border-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono font-medium">{formattedValue}</span>
        </div>
    );
};

export default function LongShortAnalysis({ data }: LongShortAnalysisProps) {
    const [filter, setFilter] = useState<'all' | 'long' | 'short'>('all');

    // Safety check - use 'all' if specific data missing
    const stats = data[filter] || data.all || {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        bestWin: 0,
        worstLoss: 0,
        averageWin: 0,
        averageLoss: 0,
        avgWinDuration: 0,
        avgLossDuration: 0,
        avgWinStreak: 0,
        avgLossStreak: 0,
        maxWinStreak: 0,
        maxLossStreak: 0
    };

    const pieData = [
        { name: 'Winners', value: stats.winningTrades },
        { name: 'Losers', value: stats.losingTrades },
    ];

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                <div className="space-y-1">
                    <CardTitle className="text-xl">Long/Short Trades</CardTitle>
                    <p className="text-sm text-muted-foreground max-w-lg">
                        You can analyze data from all the trades you opened in your trading account. Filter them by "LONG", "SHORT" or look at "ALL" your trades.
                    </p>
                </div>
                <div className="flex bg-secondary/50 p-1 rounded-lg">
                    {(['all', 'long', 'short'] as const).map((key) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${filter === key
                                ? 'bg-amber-400 text-black shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {key}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Left: Donut Chart */}
                    <div className="md:col-span-1 flex flex-col items-center justify-center relative">
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-muted-foreground text-sm">Total Trades</span>
                            <span className="text-3xl font-bold">{stats.totalTrades}</span>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={100}
                                        paddingAngle={0}
                                        dataKey="value"
                                        startAngle={90}
                                        endAngle={-270}
                                    >
                                        <Cell fill="#22c55e" /> {/* Winners - Green */}
                                        <Cell fill="#ef4444" /> {/* Losers - Red */}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right: Stats Grid */}
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-0">
                        {/* Column 1 */}
                        <div>
                            <StatRow label="Total Winners" value={stats.winningTrades} />
                            <StatRow label="Best Win" value={stats.bestWin} isCurrency />
                            <StatRow label="Average Win" value={stats.averageWin} isCurrency />
                            <StatRow label="Avg Win Duration" value={stats.avgWinDuration} isDuration />
                            <StatRow label="Avg Win Streak" value={stats.avgWinStreak} />
                            <StatRow label="Max Win Streak" value={stats.maxWinStreak} />
                        </div>

                        {/* Column 2 */}
                        <div>
                            <StatRow label="Total Losers" value={stats.losingTrades} />
                            <StatRow label="Worst Loss" value={stats.worstLoss} isCurrency />
                            <StatRow label="Average Loss" value={stats.averageLoss} isCurrency />
                            <StatRow label="Avg Loss Duration" value={stats.avgLossDuration} isDuration />
                            <StatRow label="Avg Loss Streak" value={stats.avgLossStreak} />
                            <StatRow label="Max Loss Streak" value={stats.maxLossStreak} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
