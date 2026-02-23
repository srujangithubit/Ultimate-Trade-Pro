/**
 * Export all analytics data to a multi-sheet CSV file.
 * Each section is separated by a blank row and header for clarity.
 */

import { formatCurrency } from './formatters';

interface ExportStats {
    totalPnl: number;
    winRate: number;
    profitFactor: number;
    averageRR: number;
    expectancy: number;
    winningTrades: number;
    losingTrades: number;
    totalTrades: number;
    averageWin: number;
    averageLoss: number;
    avgDailyPnl: number;
    largestWin: number;
    largestLoss: number;
    avgWinningDay: number;
    avgLosingDay: number;
    maxConsecutiveWins: number;
    maxConsecutiveLosses: number;
    largestProfitableDay: number;
    largestLosingDay: number;
    maxConsecutiveWinningDays: number;
    maxConsecutiveLosingDays: number;
    openTrades: number;
    totalDays: number;
    totalFees: number;
    totalCommission: number;
    totalSwap: number;
    bestWeek: number;
    worstWeek: number;
    bestMonth: number;
    worstMonth: number;
    avgWinStreak: number;
    avgLossStreak: number;
    maxWinStreak: number;
    maxLossStreak: number;
    winRateBySetup: any[];
    dailyPnl: any[];
    hourlyPnl: any[];
    tradeDistribution: any[];
    weeklyDistribution: any[];
    monthlyDistribution: any[];
    durationDistribution: any[];
    symbolPerformance: any[];
    sessionPerformance: any[];
}

interface ExportBreakdown {
    all: any;
    long: any;
    short: any;
}

function escapeCSV(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function formatNum(value: number | undefined | null, decimals = 2): string {
    if (value === null || value === undefined) return '0';
    return Number(value).toFixed(decimals);
}

function buildCSV(stats: ExportStats, breakdown: ExportBreakdown, equityCurve: any[]): string {
    const lines: string[] = [];

    const addSection = (title: string) => {
        lines.push('');
        lines.push(`=== ${title} ===`);
    };

    const addRow = (...values: any[]) => {
        lines.push(values.map(escapeCSV).join(','));
    };

    // ── Section 1: Overview Stats ──────────────────────────
    addSection('OVERVIEW STATISTICS');
    addRow('Metric', 'Value');
    addRow('Total P&L', formatNum(stats.totalPnl));
    addRow('Win Rate (%)', formatNum(stats.winRate));
    addRow('Profit Factor', formatNum(stats.profitFactor));
    addRow('Average R:R', formatNum(stats.averageRR));
    addRow('Expectancy', formatNum(stats.expectancy));
    addRow('Total Trades', stats.totalTrades);
    addRow('Winning Trades', stats.winningTrades);
    addRow('Losing Trades', stats.losingTrades);
    addRow('Open Trades', stats.openTrades);
    addRow('Average Win', formatNum(stats.averageWin));
    addRow('Average Loss', formatNum(stats.averageLoss));
    addRow('Avg Daily P&L', formatNum(stats.avgDailyPnl));
    addRow('Largest Win', formatNum(stats.largestWin));
    addRow('Largest Loss', formatNum(stats.largestLoss));
    addRow('Avg Winning Day', formatNum(stats.avgWinningDay));
    addRow('Avg Losing Day', formatNum(stats.avgLosingDay));
    addRow('Largest Profitable Day', formatNum(stats.largestProfitableDay));
    addRow('Largest Losing Day', formatNum(stats.largestLosingDay));
    addRow('Total Trading Days', stats.totalDays);
    addRow('Total Fees', formatNum(stats.totalFees));
    addRow('Total Commission', formatNum(stats.totalCommission));
    addRow('Total Swap', formatNum(stats.totalSwap));

    // ── Section 2: Streak & Period Stats ───────────────────
    addSection('STREAK & PERIOD STATISTICS');
    addRow('Metric', 'Value');
    addRow('Max Consecutive Wins', stats.maxConsecutiveWins);
    addRow('Max Consecutive Losses', stats.maxConsecutiveLosses);
    addRow('Max Consecutive Winning Days', stats.maxConsecutiveWinningDays);
    addRow('Max Consecutive Losing Days', stats.maxConsecutiveLosingDays);
    addRow('Avg Win Streak', formatNum(stats.avgWinStreak));
    addRow('Avg Loss Streak', formatNum(stats.avgLossStreak));
    addRow('Max Win Streak', stats.maxWinStreak);
    addRow('Max Loss Streak', stats.maxLossStreak);
    addRow('Best Week P&L', formatNum(stats.bestWeek));
    addRow('Worst Week P&L', formatNum(stats.worstWeek));
    addRow('Best Month P&L', formatNum(stats.bestMonth));
    addRow('Worst Month P&L', formatNum(stats.worstMonth));

    // ── Section 3: Long/Short Breakdown ────────────────────
    addSection('LONG / SHORT BREAKDOWN');
    const breakdownKeys = ['totalTrades', 'winningTrades', 'losingTrades', 'winRate', 'totalPnl', 'averageWin', 'averageLoss', 'profitFactor', 'largestWin', 'largestLoss'];
    addRow('Metric', 'All', 'Long', 'Short');
    for (const key of breakdownKeys) {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        addRow(
            label,
            formatNum(breakdown.all?.[key]),
            formatNum(breakdown.long?.[key]),
            formatNum(breakdown.short?.[key])
        );
    }

    // ── Section 4: Win Rate By Setup ───────────────────────
    if (stats.winRateBySetup?.length > 0) {
        addSection('WIN RATE BY SETUP');
        addRow('Setup', 'Win Rate (%)', 'Total Trades');
        for (const setup of stats.winRateBySetup) {
            addRow(setup.setup || setup.name, formatNum(setup.winRate), setup.totalTrades || setup.count || '');
        }
    }

    // ── Section 5: Daily P&L ───────────────────────────────
    if (stats.dailyPnl?.length > 0) {
        addSection('DAILY P&L');
        addRow('Date', 'Net P&L', 'Gross P&L', 'Trade Count');
        for (const day of stats.dailyPnl) {
            addRow(day.date, formatNum(day.value), formatNum(day.grossValue), day.tradeCount || '');
        }
    }

    // ── Section 6: Hourly P&L ─────────────────────────────
    if (stats.hourlyPnl?.length > 0) {
        addSection('HOURLY P&L');
        addRow('Hour', 'P&L', 'Trade Count', 'Win Rate (%)');
        for (const hour of stats.hourlyPnl) {
            addRow(
                hour.displayHour || hour.hour,
                formatNum(hour.pnl),
                hour.tradeCount || hour.count || '',
                formatNum(hour.winRate)
            );
        }
    }

    // ── Section 7: Trade Distribution (By Day) ─────────────
    if (stats.tradeDistribution?.length > 0) {
        addSection('TRADE DISTRIBUTION BY DAY');
        addRow('Day', 'Wins', 'Losses', 'Breakeven', 'Total Trades', 'Win Rate (%)', 'Total P&L');
        for (const day of stats.tradeDistribution) {
            addRow(day.day, day.wins, day.losses, day.breakeven, day.totalTrades, formatNum(day.winRate), formatNum(day.totalPnl));
        }
    }

    // ── Section 8: Weekly Distribution ─────────────────────
    if (stats.weeklyDistribution?.length > 0) {
        addSection('WEEKLY DISTRIBUTION');
        addRow('Week', 'Trade Count', 'Total P&L', 'Wins', 'Losses');
        for (const week of stats.weeklyDistribution) {
            addRow(week.week, week.tradeCount, formatNum(week.totalPnl), week.wins, week.losses);
        }
    }

    // ── Section 9: Monthly Distribution ────────────────────
    if (stats.monthlyDistribution?.length > 0) {
        addSection('MONTHLY DISTRIBUTION');
        addRow('Month', 'Year', 'Trade Count', 'Total P&L', 'Wins', 'Losses');
        for (const month of stats.monthlyDistribution) {
            addRow(month.month, month.year || '', month.tradeCount, formatNum(month.totalPnl), month.wins, month.losses);
        }
    }

    // ── Section 10: Duration Distribution ──────────────────
    if (stats.durationDistribution?.length > 0) {
        addSection('DURATION DISTRIBUTION');
        addRow('Duration Range', 'Count', 'P&L', 'Wins', 'Losses');
        for (const dur of stats.durationDistribution) {
            addRow(dur.range, dur.count, formatNum(dur.pnl), dur.wins, dur.losses);
        }
    }

    // ── Section 11: Symbol Performance ─────────────────────
    if (stats.symbolPerformance?.length > 0) {
        addSection('SYMBOL PERFORMANCE');
        addRow('Symbol', 'Trade Count', 'P&L', 'Wins', 'Losses', 'Win Rate (%)');
        for (const sym of stats.symbolPerformance) {
            addRow(sym.symbol, sym.count, formatNum(sym.pnl), sym.wins, sym.losses, formatNum(sym.winRate));
        }
    }

    // ── Section 12: Session Performance ────────────────────
    if (stats.sessionPerformance?.length > 0) {
        addSection('SESSION PERFORMANCE');
        addRow('Session', 'Net Profit', 'Win Rate (%)', 'Total Profit', 'Total Loss', 'Total Trades');
        for (const session of stats.sessionPerformance) {
            addRow(
                session.session,
                formatNum(session.netProfit),
                formatNum(session.winRate),
                formatNum(session.totalProfit),
                formatNum(session.totalLoss),
                session.totalTrades
            );
        }
    }

    // ── Section 13: Equity Curve ───────────────────────────
    if (equityCurve?.length > 0) {
        addSection('EQUITY CURVE');
        addRow('Date', 'Equity');
        for (const point of equityCurve) {
            addRow(point.date, formatNum(point.equity));
        }
    }

    return lines.join('\n');
}

export function exportAnalyticsToCSV(
    stats: ExportStats,
    breakdown: ExportBreakdown,
    equityCurve: any[]
): void {
    const csv = buildCSV(stats, breakdown, equityCurve);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `analytics_export_${dateStr}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}
