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

interface DurationStats {
    range: string;
    count: number;
    pnl: number;
    wins: number;
    losses: number;
}

interface DurationAnalyticsProps {
    data: DurationStats[];
}

function DurationAnalytics({ data }: DurationAnalyticsProps) {
    if (!data || data.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Trade Distribution by Intraday Duration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            Trade Distribution by Intraday Duration
                            <Info className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-100 w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--muted)" strokeOpacity={0.1} />
                                <XAxis type="number" hide stroke="none" />
                                <YAxis
                                    dataKey="range"
                                    type="category"
                                    stroke="none"
                                    tick={{ fill: 'var(--foreground)', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={90}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                {data.range}
                                                            </span>
                                                            <span className="font-bold text-muted-foreground">
                                                                {data.count} Trades
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
                                    dataKey="count"
                                    shape={(props: any) => <AnimatedHorizontalBar {...props} />}
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Performance by Intraday Duration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">Performance by Intraday Duration</CardTitle>
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-100 w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--muted)" strokeOpacity={0.1} />
                                <XAxis
                                    type="number"
                                    hide={false}
                                    tickFormatter={(value) => formatCurrency(value)}
                                    height={30}
                                    fontSize={10}
                                    stroke="none"
                                    tick={{ fill: 'var(--foreground)' }}
                                />
                                <YAxis
                                    dataKey="range"
                                    type="category"
                                    stroke="none"
                                    tick={{ fill: 'var(--foreground)', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={90}
                                />
                                <Tooltip
                                    cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                                {data.range}
                                                            </span>
                                                            <span className={`font-bold ${data.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                {formatCurrency(data.pnl)}
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
                                    dataKey="pnl"
                                    shape={(props: any) => <AnimatedHorizontalBar {...props} fill={props.payload.pnl >= 0 ? '#22c55e' : '#ef4444'} />}
                                    isAnimationActive={false}
                                    barSize={20}
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} />
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

export default memo(DurationAnalytics);
