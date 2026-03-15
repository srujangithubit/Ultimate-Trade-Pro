'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { motion } from 'framer-motion';

interface DayStats {
    day: string;
    wins: number;
    losses: number;
    breakeven: number;
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    totalProfit: number;
    totalLoss: number;
}

interface SummaryWeekProps {
    data: DayStats[];
}

function WinRateBar({ winRate }: { winRate: number }) {
    const lossRate = 100 - winRate;
    return (
        <div className="flex items-center gap-2">
            <div className="flex h-2.5 w-24 overflow-hidden rounded-full">
                <motion.div
                    className="bg-emerald-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${winRate}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
                <motion.div
                    className="bg-red-500"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${lossRate}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                />
            </div>
        </div>
    );
}

function SummaryWeek({ data }: SummaryWeekProps) {
    // Filter to only days with trades
    const activeDays = (data || []).filter(d => d.totalTrades > 0);

    if (activeDays.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">Summary Week</CardTitle>
                    <Info className="h-4 w-4 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-border/50 hover:bg-transparent">
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider pl-6">
                                Day
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Net Profit
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Winning %
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Total Profit
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Total Loss
                            </TableHead>
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                Total Trades
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {activeDays.map((day) => (
                            <TableRow
                                key={day.day}
                                className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                            >
                                <TableCell className="font-medium text-sm text-muted-foreground pl-6">
                                    {day.day}
                                </TableCell>
                                <TableCell
                                    className={`font-mono font-semibold text-sm ${day.totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500'
                                        }`}
                                >
                                    {day.totalPnl >= 0 ? '' : '-'}
                                    {formatCurrency(Math.abs(day.totalPnl))}
                                </TableCell>
                                <TableCell>
                                    <WinRateBar winRate={day.winRate} />
                                </TableCell>
                                <TableCell className="font-mono text-sm text-emerald-500">
                                    {formatCurrency(day.totalProfit)}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-red-500">
                                    {formatCurrency(day.totalLoss)}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                    {day.totalTrades}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default memo(SummaryWeek);
