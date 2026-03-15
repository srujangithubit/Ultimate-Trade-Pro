'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    ReferenceLine,
} from 'recharts';
import { ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatters';

interface HourlyPerformanceChartProps {
    data: { hour: number; value: number }[];
}

export function HourlyPerformanceChart({ data }: HourlyPerformanceChartProps) {
    // Format hours for display (e.g., 6 -> "06:00")
    const formattedData = data.map((item) => ({
        ...item,
        time: `${item.hour.toString().padStart(2, '0')}:00`,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Performance by Hour (UTC)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={formattedData}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--muted)" />
                            <XAxis type="number" tickFormatter={(val) => `$${val}`} stroke="var(--foreground)" />
                            <YAxis dataKey="time" type="category" width={50} stroke="var(--foreground)" />
                            <Tooltip
                                cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                                contentStyle={{
                                    backgroundColor: 'var(--card)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--foreground)',
                                }}
                                formatter={(value: any) => [formatCurrency(Number(value) || 0), 'P&L']}
                            />
                            <ReferenceLine x={0} stroke="var(--border)" />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {formattedData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.value >= 0 ? 'var(--profit)' : 'var(--loss)'}
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
