'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatters';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface AdvancedStatsProps {
    data: {
        equityCurve: { date: string; equity: number }[];
        stats: {
            averageWin: number;
            averageLoss: number;
            largestWin: number;
            largestLoss: number;
            bestWeek: number;
            worstWeek: number;
            bestMonth: number;
            worstMonth: number;
            avgWinStreak: number;
            avgLossStreak: number;
            maxWinStreak: number;
            maxLossStreak: number;
        };
    };
}

const StatBar = ({ label, value, isCurrency = false, type = 'neutral' }: { label: string; value: number; isCurrency?: boolean; type?: 'win' | 'loss' | 'neutral' }) => {
    // Calculate color based on type
    const barColor = type === 'win' ? 'bg-emerald-500' : type === 'loss' ? 'bg-red-500' : 'bg-blue-500';
    const textColor = type === 'win' ? 'text-emerald-500' : type === 'loss' ? 'text-red-500' : 'text-blue-500';

    return (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className={`font-mono font-medium ${textColor}`}>
                    {isCurrency ? formatCurrency(value || 0) : (value || 0).toFixed(2)}
                </span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className={`h-full ${barColor} w-full`} style={{ width: '100%' }} /> {/* Simplify width for now or calc % */}
            </div>
        </div>
    );
};

export default function AdvancedStatsGrid({ data }: AdvancedStatsProps) {
    const { equityCurve, stats } = data;

    return (
        <Card className="col-span-1 lg:col-span-3">
            <CardHeader>
                <CardTitle>Advanced Performance</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Equity Chart Area */}
                    <div className="lg:col-span-1 h-[300px] bg-card/50 rounded-lg border border-border/50 p-4 flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Equity Line</div>
                                <div className="text-2xl font-bold font-mono text-primary">
                                    {equityCurve.length > 0
                                        ? formatCurrency(equityCurve[equityCurve.length - 1].equity)
                                        : formatCurrency(0)}
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                                <AreaChart data={equityCurve}>
                                    <defs>
                                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" hide />
                                    <YAxis hide domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                                        formatter={(value: number | undefined) => [formatCurrency(value || 0), 'Equity']}
                                    />
                                    <Area type="monotone" dataKey="equity" stroke="#3b82f6" fillOpacity={1} fill="url(#colorEquity)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="lg:col-span-2 grid grid-cols-2 gap-x-12 gap-y-8">
                        {/* Row 1 */}
                        <StatBar label="AVG Win" value={stats.averageWin} isCurrency type="win" />
                        <StatBar label="AVG Loss" value={stats.averageLoss} isCurrency type="loss" />

                        <StatBar label="Best Win" value={stats.largestWin} isCurrency type="win" />
                        <StatBar label="Best Loss" value={stats.largestLoss} isCurrency type="loss" />

                        {/* Row 2 */}
                        <StatBar label="Best Week" value={stats.bestWeek} isCurrency type="win" />
                        <StatBar label="Worst Week" value={stats.worstWeek} isCurrency type="loss" />

                        <StatBar label="Best Month" value={stats.bestMonth} isCurrency type="win" />
                        <StatBar label="Worst Month" value={stats.worstMonth} isCurrency type="loss" />

                        {/* Row 3 - Streaks */}
                        <StatBar label="AVG Win Streak" value={stats.avgWinStreak} type="win" />
                        <StatBar label="AVG Loss Streak" value={stats.avgLossStreak} type="loss" />

                        <StatBar label="Max Win Streaks" value={stats.maxWinStreak} type="win" />
                        <StatBar label="Worst Loss Streak" value={stats.maxLossStreak} type="loss" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
