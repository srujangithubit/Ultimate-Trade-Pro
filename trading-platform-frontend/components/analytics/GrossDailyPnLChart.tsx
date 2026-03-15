'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell
} from 'recharts';
import { ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { AnimatedVerticalBar } from '@/components/ui/animated-bar';
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DailyStats {
    date: string;
    value: number; // Net P&L (kept for interface consistency)
    grossValue: number; // Gross P&L
    tradeCount: number;
}

interface GrossDailyPnLChartProps {
    data: DailyStats[];
}

function GrossDailyPnLChart({ data }: GrossDailyPnLChartProps) {
    return (
        <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        Gross Daily P&L
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                    <div className="flex gap-2 text-xs">
                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-0">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                            Win
                        </Badge>
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-0">
                            <div className="w-2 h-2 rounded-full bg-red-500 mr-1" />
                            Loss
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-75 w-full mt-4" style={{ minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" minHeight={300} debounce={50}>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--muted)" strokeOpacity={0.1} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(value) => formatDate(value)}
                                stroke="var(--foreground)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
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
                                                            Gross P&L
                                                        </span>
                                                        <span className={`font-bold ${data.grossValue >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {formatCurrency(data.grossValue)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[0.70rem] uppercase text-muted-foreground">
                                                            Trades
                                                        </span>
                                                        <span className="font-bold text-muted-foreground">
                                                            {data.tradeCount}
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
                                dataKey="grossValue"
                                shape={(props: any) => <AnimatedVerticalBar {...props} fill={props.payload.grossValue >= 0 ? '#10b981' : '#ef4444'} />}
                                isAnimationActive={false}
                            >
                                {data.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.grossValue >= 0 ? '#10b981' : '#ef4444'} // Green-500 / Red-500
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
export default memo(GrossDailyPnLChart);