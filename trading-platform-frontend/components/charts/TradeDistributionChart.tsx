'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { Info } from 'lucide-react';
import { AnimatedHorizontalBar } from '@/components/ui/animated-bar';

interface TradeDistribution {
    day: string;
    wins: number;
    losses: number;
    breakeven: number;
}

interface TradeDistributionChartProps {
    data: TradeDistribution[];
}

export default function TradeDistributionChart({ data }: TradeDistributionChartProps) {
    // Process data to get total count per day
    const chartData = data.map(d => ({
        day: d.day,
        count: d.wins + d.losses + d.breakeven,
        // Keep original details for tooltip if needed
        wins: d.wins,
        losses: d.losses,
        breakeven: d.breakeven
    }));

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        Trade Distribution by Day
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--muted)" strokeOpacity={0.1} />
                            <XAxis type="number" hide stroke="none" />
                            <YAxis
                                dataKey="day"
                                type="category"
                                stroke="none"
                                tick={{ fill: 'var(--foreground)', fontSize: 13 }}
                                axisLine={false}
                                tickLine={false}
                                width={65}
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
                                                            {data.day}
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
                                fill="#0ea5e9" // Sky-500 matches the blue in screenshot approx
                                shape={(props: any) => <AnimatedHorizontalBar {...props} />}
                                isAnimationActive={false}
                                barSize={20}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
