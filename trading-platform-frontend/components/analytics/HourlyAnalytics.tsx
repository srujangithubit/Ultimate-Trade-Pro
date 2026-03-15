'use client';

import { useState, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, Clock } from 'lucide-react';
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
import { TIMEZONES } from '@/lib/utils/timezones';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface HourlyStats {
    hour: number;
    pnl: number;
    count: number;
    wins: number;
    losses: number;
    winRate: number;
}

interface HourlyAnalyticsProps {
    data: HourlyStats[];
}



function HourlyAnalytics({ data }: HourlyAnalyticsProps) {
    const [statsTimezone, setStatsTimezone] = useState('UTC');

    const processedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const selectedTz = TIMEZONES.find(t => t.value === statsTimezone) || TIMEZONES[0];
        const offset = selectedTz.offset;

        // Create 24 hour buckets
        const buckets = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            displayHour: `${i.toString().padStart(2, '0')}:00`,
            pnl: 0,
            count: 0,
            wins: 0,
            losses: 0
        }));

        // Map UTC data to target timezone buckets
        data.forEach(stat => {
            // Apply offset
            let targetHour = stat.hour + offset;

            // Handle wrap-around logic for negative/positive overflow
            // e.g. UTC 0 + (-5 EST) = -5 -> 19 (7 PM previous day)
            // e.g. UTC 23 + (1 CET) = 24 -> 0 (Next day)
            // We are aggregating by "Hour of Day", so day boundaries merge.
            // 7 PM yesterday is same bucket as 7 PM today for "Hour Analysis".

            // Normalize to 0-23 range
            targetHour = targetHour % 24;
            if (targetHour < 0) targetHour += 24;

            // Handle fractional offsets (e.g. India +5.5)
            // For simplicity, we floor it to the nearest hour bucket
            targetHour = Math.floor(targetHour);

            if (buckets[targetHour]) {
                buckets[targetHour].pnl += stat.pnl;
                buckets[targetHour].count += stat.count;
                buckets[targetHour].wins += stat.wins;
                buckets[targetHour].losses += stat.losses;
            }
        });

        // Filter out empty hours if desired, or keep all 24
        // Typically keeping 0-23 makes the chart cleaner to read as a timeline
        return buckets;
    }, [data, statsTimezone]);

    return (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Header / Controls */}
            <div className="lg:col-span-2 flex justify-end">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Select value={statsTimezone} onValueChange={setStatsTimezone}>
                        <SelectTrigger className="w-60">
                            <SelectValue placeholder="Select Timezone" />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEZONES.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label} ({tz.offset > 0 ? '+' : ''}{tz.offset})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Trade Distribution by Hour */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            Trade Distribution by Hour ({statsTimezone})
                            <Info className="h-4 w-4 text-muted-foreground" />
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-100 w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                            <BarChart
                                data={processedData}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--muted)" strokeOpacity={0.1} />
                                <XAxis type="number" hide stroke="none" />
                                <YAxis
                                    dataKey="displayHour"
                                    type="category"
                                    stroke="none"
                                    tick={{ fill: 'var(--foreground)', fontSize: 13 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={40}
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
                                                                {data.displayHour}
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
                                    barSize={12}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Performance by Hour */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold">Performance by Hour ({statsTimezone})</CardTitle>
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-100 w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                            <BarChart
                                data={processedData}
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
                                    dataKey="displayHour"
                                    type="category"
                                    stroke="none"
                                    tick={{ fill: 'var(--foreground)', fontSize: 13 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={40}
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
                                                                {data.displayHour}
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
                                    barSize={12}
                                >
                                    {processedData.map((entry, index) => (
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

export default memo(HourlyAnalytics);
