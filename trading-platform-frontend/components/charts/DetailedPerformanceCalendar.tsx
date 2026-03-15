'use client';

import { useState, useMemo } from 'react';
import { formatCurrency, formatPercent } from '@/lib/utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';

interface DailyStats {
    date: string;
    value: number;
    tradeCount: number;
}

interface DetailedPerformanceCalendarProps {
    data: DailyStats[];
}

export default function DetailedPerformanceCalendar({ data }: DetailedPerformanceCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const { days, stats, weeks } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Filter data for current month
        const monthData = data.filter(d => {
            const date = new Date(d.date);
            return date.getFullYear() === year && date.getMonth() === month;
        });

        // Calculate Stats
        const tradingDays = monthData.length;
        const winningDays = monthData.filter(d => d.value > 0).length;
        const losingDays = monthData.filter(d => d.value < 0).length;
        const dayWinRate = tradingDays > 0 ? (winningDays / tradingDays) * 100 : 0;

        // Generate Calendar Grid
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // Mon=0, Sun=6 adjustment? 
        // Standard JS: Sun=0. Let's assume Mon start for trading calendars usually.
        // Let's stick to standard Sunday start for simplicity or adjust to Mon.
        // Image shows Mon-Sun.

        const calendarDays: (DailyStats | null)[] = [];

        // Pad start
        // JS getDay(): Sun=0, Mon=1...Sat=6.
        // We want Mon=0...Sun=6.
        // If Sun(0), it becomes 6. If Mon(1), it becomes 0.
        const adjustedStartDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;

        for (let i = 0; i < adjustedStartDay; i++) {
            calendarDays.push(null);
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = new Date(year, month, i).toLocaleDateString('en-CA'); // YYYY-MM-DD local
            // Fix: ISOString uses UTC, localDateString might differ.
            // Safer: manual construct
            const d = new Date(year, month, i);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const isoDate = `${y}-${m}-${day}`;

            const dayData = monthData.find(md => md.date === isoDate);
            calendarDays.push(dayData || { date: isoDate, value: 0, tradeCount: 0 });
        }

        // Weekly Summaries
        const weekSummaries: number[] = [];
        let currentWeekTotal = 0;
        calendarDays.forEach((day, index) => {
            if (day) currentWeekTotal += day.value;
            if ((index + 1) % 7 === 0 || index === calendarDays.length - 1) {
                weekSummaries.push(currentWeekTotal);
                currentWeekTotal = 0;
            }
        });

        return {
            days: calendarDays,
            stats: {
                tradingDays,
                winningDays,
                losingDays,
                dayWinRate
            },
            weeks: weekSummaries
        };
    }, [data, currentDate]);

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
    const weekLabels = ['1st Week', '2nd Week', '3rd Week', '4th Week', '5th Week'];

    return (
        <div className="space-y-4">
            {/* Weekly Headers */}
            <div className="grid grid-cols-5 gap-4 mb-6">
                {weeks.map((total, i) => (
                    <div key={i} className="flex flex-col">
                        <span className="text-xs text-muted-foreground mb-1">{weekLabels[i]}</span>
                        <span className="text-2xl font-bold">{formatCurrency(total)}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calendar */}
                <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="font-semibold w-32 text-center">{monthName}</span>
                            <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <Info className="h-4 w-4 text-muted-foreground" />
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        {/* Days Header */}
                        <div className="grid grid-cols-7 border-b bg-muted/30">
                            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
                                <div key={d} className="py-2 px-3 text-xs font-medium text-muted-foreground border-r last:border-r-0">
                                    {d}
                                </div>
                            ))}
                        </div>
                        {/* Days Grid */}
                        <div className="grid grid-cols-7">
                            {days.map((day, i) => (
                                <div key={i} className={`min-h-[100px] border-r border-b p-2 relative group hover:bg-accent/20 transition-colors ${!day ? 'bg-muted/10' : ''}`}>
                                    {day && (
                                        <>
                                            <span className="text-xs text-muted-foreground absolute top-2 left-2">
                                                {parseInt(day.date.split('-')[2])}
                                            </span>
                                            {day.tradeCount > 0 && (
                                                <div className={`mt-6 p-2 rounded text-center ${day.value >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                    <div className="font-bold text-sm tracking-tight">{formatCurrency(day.value)}</div>
                                                    <div className="text-[10px] font-medium mt-0.5">{day.tradeCount} Trades</div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-xs text-muted-foreground mb-1">Trading Days</div>
                                <div className="text-xl font-bold">{stats.tradingDays || '-'}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-xs text-muted-foreground mb-1">Day Win rate</div>
                                <div className="text-xl font-bold">{formatPercent(stats.dayWinRate)}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="h-64 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Wins', value: stats.winningDays },
                                        { name: 'Losses', value: stats.losingDays }
                                    ]}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#22c55e" />
                                    <Cell fill="#ef4444" />
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </Card>

                    <div className="grid grid-cols-2 gap-4">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-xs text-muted-foreground mb-1">Winning Days</div>
                                <div className="text-xl font-bold">{stats.winningDays || '-'}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-xs text-muted-foreground mb-1">Losing Days</div>
                                <div className="text-xl font-bold">{stats.losingDays || '-'}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
