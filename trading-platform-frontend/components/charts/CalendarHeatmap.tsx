'use client';

import { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils/formatters';

interface CalendarHeatmapProps {
    data: { date: string; value: number }[];
}

export default function CalendarHeatmap({ data }: CalendarHeatmapProps) {
    const weeks = useMemo(() => {
        if (!data || data.length === 0) return [];

        // Ensure sorted by date
        const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const startDate = new Date(sortedData[0].date);
        const endDate = new Date(sortedData[sortedData.length - 1].date);

        // Create lookup map for O(1) access
        const dataMap = new Map(data.map(d => [d.date, d.value]));

        const result: { date: string; value: number | null; dayOfWeek: number }[][] = [];
        let currentWeek: { date: string; value: number | null; dayOfWeek: number }[] = [];

        const current = new Date(startDate);
        // Backfill to start of week (Sunday)
        current.setDate(current.getDate() - current.getDay());

        while (current <= endDate || currentWeek.length > 0) {
            const dateStr = current.toISOString().split('T')[0];
            const dayOfWeek = current.getDay();

            currentWeek.push({
                date: dateStr,
                value: dataMap.get(dateStr) ?? null,
                dayOfWeek,
            });

            if (dayOfWeek === 6) {
                result.push(currentWeek);
                currentWeek = [];
                if (current > endDate) break;
            }

            current.setDate(current.getDate() + 1);
        }

        if (currentWeek.length > 0) {
            result.push(currentWeek);
        }

        return result;
    }, [data]);

    const getColor = (value: number | null) => {
        if (value === null) return 'bg-muted/30';
        if (value > 500) return 'bg-green-500';
        if (value > 200) return 'bg-green-400/80';
        if (value > 0) return 'bg-green-300/60';
        if (value > -200) return 'bg-red-300/60';
        if (value > -500) return 'bg-red-400/80';
        return 'bg-red-500';
    };

    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <div className="space-y-3">
            <div className="flex gap-1">
                {/* Day labels */}
                <div className="flex flex-col gap-1 mr-1">
                    {dayLabels.map((label, i) => (
                        <div key={i} className="h-4 w-4 flex items-center justify-center text-[9px] text-muted-foreground">
                            {i % 2 === 1 ? label : ''}
                        </div>
                    ))}
                </div>

                {/* Weeks */}
                {weeks.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-1">
                        {week.map((day) => (
                            <div
                                key={day.date}
                                className={`h-4 w-4 rounded-sm ${getColor(day.value)} transition-smooth cursor-pointer hover:ring-1 hover:ring-foreground/30`}
                                title={`${day.date}: ${day.value !== null ? formatCurrency(day.value) : 'No data'}`}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Loss</span>
                <div className="flex gap-0.5">
                    <div className="h-3 w-3 rounded-sm bg-red-500" />
                    <div className="h-3 w-3 rounded-sm bg-red-400/80" />
                    <div className="h-3 w-3 rounded-sm bg-red-300/60" />
                    <div className="h-3 w-3 rounded-sm bg-muted/30" />
                    <div className="h-3 w-3 rounded-sm bg-green-300/60" />
                    <div className="h-3 w-3 rounded-sm bg-green-400/80" />
                    <div className="h-3 w-3 rounded-sm bg-green-500" />
                </div>
                <span>Profit</span>
            </div>
        </div>
    );
}
