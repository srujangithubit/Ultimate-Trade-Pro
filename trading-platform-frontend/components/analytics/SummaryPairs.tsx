'use client';

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

interface PairStats {
    symbol: string;
    count: number;
    pnl: number;
    wins: number;
    losses: number;
    totalProfit: number;
    totalLoss: number;
    winRate: number;
    netProfitPercent: number;
}

interface SummaryPairsProps {
    data: PairStats[];
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

export default function SummaryPairs({ data }: SummaryPairsProps) {
    const activePairs = (data || []).filter(d => d.count > 0);

    if (activePairs.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold">Summary Pairs</CardTitle>
                    <Info className="h-4 w-4 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="border-b border-border/50 hover:bg-transparent">
                            <TableHead className="text-muted-foreground font-medium text-xs uppercase tracking-wider pl-6">
                                Pair
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
                        {activePairs.map((pair) => (
                            <TableRow
                                key={pair.symbol}
                                className="border-b border-border/30 hover:bg-accent/30 transition-colors"
                            >
                                <TableCell className="font-medium text-sm text-muted-foreground pl-6">
                                    {pair.symbol}
                                </TableCell>
                                <TableCell
                                    className={`font-mono font-semibold text-sm ${pair.netProfitPercent >= 0 ? 'text-emerald-500' : 'text-red-500'
                                        }`}
                                >
                                    {pair.netProfitPercent >= 0 ? '' : '-'}
                                    {Math.abs(pair.netProfitPercent).toFixed(2)}%
                                </TableCell>
                                <TableCell>
                                    <WinRateBar winRate={pair.winRate} />
                                </TableCell>
                                <TableCell className="font-mono text-sm text-emerald-500">
                                    {formatCurrency(pair.totalProfit)}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-red-500">
                                    {formatCurrency(pair.totalLoss)}
                                </TableCell>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                    {pair.count}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
