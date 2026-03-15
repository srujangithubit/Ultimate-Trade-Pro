'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
    Cell
} from 'recharts';
import { ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { formatCurrency } from '@/lib/utils/formatters';
import { AnimatedHorizontalBar } from '@/components/ui/animated-bar';

interface WeeklyStats {
    week: string; // "Feb 9 - 15"
    weekStart: string;
    tradeCount: number;
    totalPnl: number;
    wins: number;
    losses: number;
}

interface WeeklyAnalyticsProps {
    data: WeeklyStats[];
}

function WeeklyAnalytics({ data }: WeeklyAnalyticsProps) {
    if (!data || data.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Trade Distribution by Week */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            Trade Distribution by Week
                            <Info className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-75 w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--muted)" strokeOpacity={0.1} />
                                <XAxis type="number" hide stroke="none" />
                                <YAxis
                                    dataKey="week"
                                    type="category"
                                    stroke="none"
                                    tick={{ fill: 'var(--foreground)', fontSize: 13 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={75}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                {data.week}
                                                            </span>
                                                            <span className="font-bold text-muted-foreground">
                                                                {data.tradeCount} Trades
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar
                                    dataKey="tradeCount"
                                    fill="#0ea5e9"
                                    shape={(props: any) => <AnimatedHorizontalBar {...props} />}
                                    isAnimationActive={false}
                                    barSize={20}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Performance by Week */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">Performance by Week</CardTitle>
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-75 w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--muted)" strokeOpacity={0.1} />
                                <XAxis
                                    type="number"
                                    hide={false}
                                    tickFormatter={(value) => formatCurrency(value)}
                                    fontSize={10}
                                    stroke="none"
                                    tick={{ fill: 'var(--foreground)' }}
                                />
                                <YAxis
                                    dataKey="week"
                                    type="category"
                                    stroke="none"
                                    tick={{ fill: 'var(--foreground)', fontSize: 13 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={75}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                {data.week}
                                                            </span>
                                                            <span className={`font-bold ${data.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                {formatCurrency(data.totalPnl)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
                                <Bar
                                    dataKey="totalPnl"
                                    shape={(props: any) => <AnimatedHorizontalBar {...props} fill={props.payload.totalPnl >= 0 ? '#22c55e' : '#ef4444'} />}
                                    isAnimationActive={false}
                                    barSize={20}
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.totalPnl >= 0 ? '#22c55e' : '#ef4444'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default memo(WeeklyAnalytics);
