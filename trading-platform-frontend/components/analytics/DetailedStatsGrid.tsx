'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/utils/formatters';

interface DetailedStats {
    totalPnl: number;
    averageWin: number;
    averageLoss: number;
    avgDailyPnl: number;
    largestWin: number;
    largestLoss: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWinningDay: number;
    avgLosingDay: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    largestProfitableDay: number;
    largestLosingDay: number;
    maxConsecutiveWinningDays: number;
    maxConsecutiveLosingDays: number;
    openTrades: number;
    profitFactor: number;
    expectancy: number;
    totalDays: number;
    totalFees: number;
    totalCommission: number;
    totalSwap: number;
}

interface DetailedStatsGridProps {
    stats: DetailedStats;
}

export default function DetailedStatsGrid({ stats }: DetailedStatsGridProps) {
    const mainCards = [
        { title: 'Total P&L', value: formatCurrency(stats.totalPnl), large: true, positive: stats.totalPnl >= 0 },
        { title: 'Avg Trade P&L', value: formatCurrency(stats.expectancy), large: true },
        { title: 'Avg Daily P&L', value: formatCurrency(stats.avgDailyPnl), large: true },
        { title: 'Largest Profit', value: formatCurrency(stats.largestWin), large: true },
        { title: 'Largest Loss', value: formatCurrency(stats.largestLoss), large: true },
        { title: 'Total Trades', value: stats.totalTrades, large: true },
        { title: 'Winning Trades', value: stats.winningTrades, large: true },
        { title: 'Losing Trades', value: stats.losingTrades, large: true },
    ];

    const detailRows = [
        { label: 'Avg Winning Trade', value: formatCurrency(stats.averageWin) },
        { label: 'Avg Losing Trade', value: formatCurrency(stats.averageLoss) },
        { label: 'Avg Daily Volume', value: formatNumber(stats.totalDays > 0 ? stats.totalTrades / stats.totalDays : 0) },
        { label: 'Trade Expectancy', value: formatCurrency(stats.expectancy) },
        { label: 'Avg Winning Day P&L', value: formatCurrency(stats.avgWinningDay) },
        { label: 'Avg Losing Day P&L', value: formatCurrency(stats.avgLosingDay) },
        { label: 'Total Commissions', value: formatCurrency(stats.totalCommission || 0) }, // Assuming we add this later
        { label: 'Total Fees', value: formatCurrency(stats.totalFees || 0) },
        { label: 'Max Consecutive Wins', value: stats.maxConsecutiveWins },
        { label: 'Max Consecutive Losses', value: stats.maxConsecutiveLosses },
        { label: 'Total Swap', value: formatCurrency(stats.totalSwap || 0) },
        { label: 'Profit Factor', value: formatNumber(stats.profitFactor) },
        { label: 'Largest Profitable Day', value: formatCurrency(stats.largestProfitableDay) },
        { label: 'Largest Losing Day', value: formatCurrency(stats.largestLosingDay) },
        { label: 'Largest Win', value: formatCurrency(stats.largestWin) },
        { label: 'Largest Loss', value: formatCurrency(stats.largestLoss) },
        { label: 'Max Consecutive Winning Days', value: stats.maxConsecutiveWinningDays },
        { label: 'Max Consecutive Losing Days', value: stats.maxConsecutiveLosingDays },
        { label: 'Logged Days', value: stats.totalDays },
        { label: 'Open Trades', value: stats.openTrades },
    ];

    return (
        <div className="space-y-6">
            {/* Top Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {mainCards.map((card, i) => (
                    <Card key={i} className="bg-card/50">
                        <CardContent className="p-6">
                            <div className="text-sm font-medium text-muted-foreground mb-2">{card.title}</div>
                            <div className={`text-2xl font-bold ${card.positive === true ? 'text-profit' :
                                    card.positive === false ? 'text-loss' : ''
                                }`}>
                                {card.value}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 text-sm">
                {detailRows.map((row, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-mono font-medium">{row.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
