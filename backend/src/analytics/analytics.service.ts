import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
    constructor(private readonly prisma: PrismaService) { }

    async getMetrics(userId: string) {
        const trades = await this.prisma.trade.findMany({
            where: { userId, status: 'CLOSED' },
        });

        const totalTrades = trades.length;
        let wins = 0;
        let totalPnL = 0;
        let grossProfit = 0;
        let grossLoss = 0;

        for (const trade of trades) {
            const pnl = Number(trade.pnlNet) || 0;
            totalPnL += pnl;
            if (pnl > 0) {
                wins++;
                grossProfit += pnl;
            } else {
                grossLoss += Math.abs(pnl);
            }
        }
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const averagePnL = totalTrades > 0 ? totalPnL / totalTrades : 0;
        const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

        return {
            totalTrades,
            winRate: Number(winRate.toFixed(2)),
            totalPnL: Number(totalPnL.toFixed(2)),
            averagePnL: Number(averagePnL.toFixed(2)),
            profitFactor: Number(profitFactor.toFixed(2)),
        };
    }

    async getOverview(userId: string) {
        const trades = await this.prisma.trade.findMany({
            where: { userId, status: 'CLOSED' },
            orderBy: { entryDate: 'asc' },
        });

        const winners = trades.filter((t) => (Number(t.pnlNet) || 0) > 0);
        const losers = trades.filter((t) => (Number(t.pnlNet) || 0) < 0);

        const totalPnl = trades.reduce((s, t) => s + (Number(t.pnlNet) || 0), 0);
        const totalTrades = trades.length;
        const winningTrades = winners.length;
        const losingTrades = losers.length;
        const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

        const avgWin = winningTrades > 0 ? winners.reduce((s, t) => s + (Number(t.pnlNet) || 0), 0) / winningTrades : 0;
        const avgLoss = losingTrades > 0 ? Math.abs(losers.reduce((s, t) => s + (Number(t.pnlNet) || 0), 0) / losingTrades) : 0;
        const profitFactor = avgLoss > 0 ? (avgWin * winningTrades) / (avgLoss * losingTrades) : 0;
        const averageRR = avgLoss > 0 ? avgWin / avgLoss : 0;
        const expectancy = totalTrades > 0 ? totalPnl / totalTrades : 0;

        const largestWin = winners.length > 0 ? Math.max(...winners.map((t) => Number(t.pnlNet) || 0)) : 0;
        const largestLoss = losers.length > 0 ? Math.min(...losers.map((t) => Number(t.pnlNet) || 0)) : 0;

        // Consecutive wins/losses
        let maxConsecutiveWins = 0, maxConsecutiveLosses = 0;
        let currentWins = 0, currentLosses = 0;
        for (const t of trades) {
            if ((Number(t.pnlNet) || 0) > 0) {
                currentWins++;
                currentLosses = 0;
                maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
            } else {
                currentLosses++;
                currentWins = 0;
                maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
            }
        }

        // Daily P&L aggregation
        const dailyMap = new Map<string, { pnl: number; count: number }>();
        for (const t of trades) {
            const day = new Date(t.exitDate ?? t.entryDate).toISOString().split('T')[0];
            const existing = dailyMap.get(day) ?? { pnl: 0, count: 0 };
            dailyMap.set(day, { pnl: existing.pnl + (Number(t.pnlNet) || 0), count: existing.count + 1 });
        }
        const dailyPnl = Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, { pnl, count }]) => ({
                date,
                pnl,
                value: pnl,
                grossValue: pnl,
                tradeCount: count
            }));

        const dailyPnls = dailyPnl.map((d) => d.pnl);
        const winningDays = dailyPnls.filter((p) => p > 0);
        const losingDays = dailyPnls.filter((p) => p < 0);
        const avgDailyPnl = dailyPnls.length > 0 ? dailyPnls.reduce((s, v) => s + v, 0) / dailyPnls.length : 0;
        const avgWinningDay = winningDays.length > 0 ? winningDays.reduce((s, v) => s + v, 0) / winningDays.length : 0;
        const avgLosingDay = losingDays.length > 0 ? losingDays.reduce((s, v) => s + v, 0) / losingDays.length : 0;
        const largestProfitableDay = winningDays.length > 0 ? Math.max(...winningDays) : 0;
        const largestLosingDay = losingDays.length > 0 ? Math.min(...losingDays) : 0;

        // Consecutive winning/losing days
        let maxConsecutiveWinningDays = 0, maxConsecutiveLosingDays = 0;
        let cwDays = 0, clDays = 0;
        for (const p of dailyPnls) {
            if (p > 0) { cwDays++; clDays = 0; maxConsecutiveWinningDays = Math.max(maxConsecutiveWinningDays, cwDays); }
            else { clDays++; cwDays = 0; maxConsecutiveLosingDays = Math.max(maxConsecutiveLosingDays, clDays); }
        }

        // Hourly P&L
        const hourlyMap = new Map<number, { pnl: number; count: number }>();
        for (const t of trades) {
            const hour = new Date(t.entryDate).getHours();
            const existing = hourlyMap.get(hour) ?? { pnl: 0, count: 0 };
            hourlyMap.set(hour, { pnl: existing.pnl + (Number(t.pnlNet) || 0), count: existing.count + 1 });
        }
        const hourlyPnl = Array.from(hourlyMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([hour, { pnl, count }]) => ({ hour, pnl, count }));

        // Trade Distribution by Day of Week
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const tradeDistMap = new Map<string, { wins: number, losses: number, breakeven: number, totalPnl: number, totalTrades: number, totalProfit: number, totalLoss: number }>();
        daysOfWeek.forEach(d => tradeDistMap.set(d, { wins: 0, losses: 0, breakeven: 0, totalPnl: 0, totalTrades: 0, totalProfit: 0, totalLoss: 0 }));

        for (const t of trades) {
            const dayName = daysOfWeek[new Date(t.entryDate).getDay()];
            const dist = tradeDistMap.get(dayName)!;
            const pnl = Number(t.pnlNet) || 0;
            if (pnl > 0) {
                dist.wins++;
                dist.totalProfit += pnl;
            } else if (pnl < 0) {
                dist.losses++;
                dist.totalLoss += Math.abs(pnl);
            } else {
                dist.breakeven++;
            }
            dist.totalPnl += pnl;
            dist.totalTrades++;
        }

        const tradeDistribution = Array.from(tradeDistMap.entries()).map(([day, stats]) => ({
            day,
            wins: stats.wins,
            losses: stats.losses,
            breakeven: stats.breakeven,
            totalTrades: stats.totalTrades,
            totalPnl: stats.totalPnl,
            totalProfit: stats.totalProfit,
            totalLoss: stats.totalLoss,
            winRate: stats.totalTrades > 0 ? (stats.wins / stats.totalTrades) * 100 : 0
        }));

        // Open trades
        const openTrades = await this.prisma.trade.count({
            where: { userId, status: 'OPEN' },
        });

        // We use fees instead of totalFees based on our schema, let's just make it 0 for now as fees isn't mapped
        const totalFees = 0;

        // Win Rate by Setup (mock/basic)
        const setupMap = new Map<string, { wins: number, total: number }>();
        for (const t of trades) {
            if (!t.setup) continue;
            const existing = setupMap.get(t.setup) || { wins: 0, total: 0 };
            if ((Number(t.pnlNet) || 0) > 0) existing.wins++;
            existing.total++;
            setupMap.set(t.setup, existing);
        }
        const winRateBySetup = Array.from(setupMap.entries()).map(([setup, stats]) => ({
            setup,
            winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0
        }));

        // Symbol Performance
        const symbolMap = new Map<string, { wins: number, total: number, pnl: number, totalProfit: number, totalLoss: number }>();
        for (const t of trades) {
            const sym = t.symbol || 'Unknown';
            const existing = symbolMap.get(sym) || { wins: 0, total: 0, pnl: 0, totalProfit: 0, totalLoss: 0 };
            const pnl = Number(t.pnlNet) || 0;
            if (pnl > 0) {
                existing.wins++;
                existing.totalProfit += pnl;
            } else if (pnl < 0) {
                existing.totalLoss += Math.abs(pnl);
            }
            existing.total++;
            existing.pnl += pnl;
            symbolMap.set(sym, existing);
        }
        const symbolPerformance = Array.from(symbolMap.entries()).map(([symbol, stats]) => ({
            symbol,
            winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0,
            pnl: stats.pnl,
            totalProfit: stats.totalProfit,
            totalLoss: stats.totalLoss,
            trades: stats.total,
            count: stats.total,
            netProfitPercent: stats.total > 0 ? (stats.pnl / stats.total) : 0
        }));

        // Session Performance (Basic inference based on hours)
        const sessionMap = new Map<string, { wins: number, total: number, pnl: number, totalProfit: number, totalLoss: number }>();
        const sessionNames = ['London', 'NY', 'Asian', 'Outside of Sessions'];
        sessionNames.forEach(s => sessionMap.set(s, { wins: 0, total: 0, pnl: 0, totalProfit: 0, totalLoss: 0 }));

        for (const t of trades) {
            const hour = new Date(t.entryDate).getHours();
            let session = 'Outside of Sessions';
            if (hour >= 8 && hour < 16) session = 'London'; // 8am-4pm GMT approximation
            else if (hour >= 13 && hour < 21) session = 'NY'; // 1pm-9pm GMT approximation
            else if (hour >= 23 || hour < 8) session = 'Asian'; // 11pm-8am GMT approximation

            const existing = sessionMap.get(session)!;
            const pnl = Number(t.pnlNet) || 0;
            if (pnl > 0) {
                existing.wins++;
                existing.totalProfit += pnl;
            } else if (pnl < 0) {
                existing.totalLoss += Math.abs(pnl);
            }
            existing.total++;
            existing.pnl += pnl;
        }

        const sessionPerformance = Array.from(sessionMap.entries()).map(([session, stats]) => ({
            session,
            netProfit: stats.pnl,
            totalProfit: stats.totalProfit,
            totalLoss: stats.totalLoss,
            wins: stats.wins,
            losses: stats.total - stats.wins,
            totalTrades: stats.total,
            winRate: stats.total > 0 ? (stats.wins / stats.total) * 100 : 0
        }));

        // Long/Short Breakdown
        const createEmptyBreakdown = () => ({
            totalTrades: 0, winningTrades: 0, losingTrades: 0,
            bestWin: 0, worstLoss: 0, averageWin: 0, averageLoss: 0,
            avgWinDuration: 0, avgLossDuration: 0,
            avgWinStreak: 0, avgLossStreak: 0, maxWinStreak: 0, maxLossStreak: 0,
            _totalWinDuration: 0, _totalLossDuration: 0, _totalWinPnl: 0, _totalLossPnl: 0
        });

        const breakdown = {
            all: createEmptyBreakdown(),
            long: createEmptyBreakdown(),
            short: createEmptyBreakdown()
        };

        for (const t of trades) {
            const pnl = Number(t.pnlNet) || 0;
            const isWin = pnl > 0;
            const isLoss = pnl < 0;
            const durMs = t.exitDate ? new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime() : 0;
            const durMins = durMs / 60000;
            const dirKey = t.direction?.toLowerCase() === 'short' ? 'short' : 'long'; // Default long if null for now

            const processStats = (stats: any) => {
                stats.totalTrades++;
                if (isWin) {
                    stats.winningTrades++;
                    stats._totalWinPnl += pnl;
                    stats.bestWin = Math.max(stats.bestWin, pnl);
                    stats._totalWinDuration += durMins;
                } else if (isLoss) {
                    stats.losingTrades++;
                    stats._totalLossPnl += pnl;
                    stats.worstLoss = Math.min(stats.worstLoss, pnl);
                    stats._totalLossDuration += durMins;
                }
            };
            processStats(breakdown.all);
            processStats(breakdown[dirKey as 'long' | 'short']);
        }

        ['all', 'long', 'short'].forEach(k => {
            const b = breakdown[k as keyof typeof breakdown];
            b.averageWin = b.winningTrades > 0 ? b._totalWinPnl / b.winningTrades : 0;
            b.averageLoss = b.losingTrades > 0 ? b._totalLossPnl / b.losingTrades : 0;
            b.avgWinDuration = b.winningTrades > 0 ? b._totalWinDuration / b.winningTrades : 0;
            b.avgLossDuration = b.losingTrades > 0 ? b._totalLossDuration / b.losingTrades : 0;

            // Re-using the main streaks for "All" is safest for now
            if (k === 'all') {
                b.maxWinStreak = maxConsecutiveWins;
                b.maxLossStreak = maxConsecutiveLosses;
            }
        });

        // Monthly Distribution
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const monthlyMap = new Map<string, { year: number, tradeCount: number, totalPnl: number, wins: number, losses: number }>();
        for (const t of trades) {
            const d = new Date(t.entryDate);
            const month = monthNames[d.getMonth()];
            const year = d.getFullYear();
            const key = `${month} ${year}`;
            const existing = monthlyMap.get(key) || { year, tradeCount: 0, totalPnl: 0, wins: 0, losses: 0 };
            const pnl = Number(t.pnlNet) || 0;
            existing.tradeCount++;
            existing.totalPnl += pnl;
            if (pnl > 0) existing.wins++;
            else if (pnl < 0) existing.losses++;
            monthlyMap.set(key, existing);
        }
        const monthlyDistribution = Array.from(monthlyMap.entries()).map(([key, stats]) => ({
            month: key.split(' ')[0],
            year: stats.year,
            tradeCount: stats.tradeCount,
            totalPnl: stats.totalPnl,
            wins: stats.wins,
            losses: stats.losses
        }));

        // Weekly Distribution
        const getStartOfWeek = (d: Date) => {
            const date = new Date(d);
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(date.setDate(diff));
        };
        const weeklyMap = new Map<string, { weekStart: string, tradeCount: number, totalPnl: number, wins: number, losses: number, weekLabel: string }>();
        for (const t of trades) {
            const d = new Date(t.entryDate);
            const startObj = getStartOfWeek(d);
            const endObj = new Date(startObj);
            endObj.setDate(endObj.getDate() + 6);

            const startMonth = monthNames[startObj.getMonth()].substring(0, 3);
            const endMonth = monthNames[endObj.getMonth()].substring(0, 3);
            const weekLabel = startMonth === endMonth
                ? `${startMonth} ${startObj.getDate()} - ${endObj.getDate()}`
                : `${startMonth} ${startObj.getDate()} - ${endMonth} ${endObj.getDate()}`;

            const weekStartKey = startObj.toISOString().split('T')[0];
            const existing = weeklyMap.get(weekStartKey) || { weekStart: weekStartKey, tradeCount: 0, totalPnl: 0, wins: 0, losses: 0, weekLabel };
            const pnl = Number(t.pnlNet) || 0;
            existing.tradeCount++;
            existing.totalPnl += pnl;
            if (pnl > 0) existing.wins++;
            else if (pnl < 0) existing.losses++;
            weeklyMap.set(weekStartKey, existing);
        }
        const weeklyDistribution = Array.from(weeklyMap.values())
            .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
            .map(stats => ({
                week: stats.weekLabel,
                weekStart: stats.weekStart,
                tradeCount: stats.tradeCount,
                totalPnl: stats.totalPnl,
                wins: stats.wins,
                losses: stats.losses
            }));

        // Duration Distribution
        const durationMap = new Map<string, { count: number, pnl: number, wins: number, losses: number }>();
        const ranges = ['0-15m', '15-30m', '30-60m', '1h-4h', '4h+'];
        ranges.forEach(r => durationMap.set(r, { count: 0, pnl: 0, wins: 0, losses: 0 }));
        for (const t of trades) {
            if (!t.exitDate) continue;
            const durMs = new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime();
            const durMins = durMs / 60000;

            let range = '4h+';
            if (durMins <= 15) range = '0-15m';
            else if (durMins <= 30) range = '15-30m';
            else if (durMins <= 60) range = '30-60m';
            else if (durMins <= 240) range = '1h-4h';

            const existing = durationMap.get(range)!;
            const pnl = Number(t.pnlNet) || 0;
            existing.count++;
            existing.pnl += pnl;
            if (pnl > 0) existing.wins++;
            else if (pnl < 0) existing.losses++;
        }
        const durationDistribution = Array.from(durationMap.entries()).map(([range, stats]) => ({
            range,
            count: stats.count,
            pnl: stats.pnl,
            wins: stats.wins,
            losses: stats.losses
        }));

        const bestWeek = weeklyDistribution.length > 0 ? Math.max(...weeklyDistribution.map(w => w.totalPnl)) : 0;
        const worstWeek = weeklyDistribution.length > 0 ? Math.min(...weeklyDistribution.map(w => w.totalPnl)) : 0;

        const bestMonth = monthlyDistribution.length > 0 ? Math.max(...monthlyDistribution.map(m => m.totalPnl)) : 0;
        const worstMonth = monthlyDistribution.length > 0 ? Math.min(...monthlyDistribution.map(m => m.totalPnl)) : 0;

        // Calculate average streaks by iterating properly 
        let winStreaks: number[] = [];
        let lossStreaks: number[] = [];
        let currWinRun = 0;
        let currLossRun = 0;

        for (const t of trades) {
            const val = Number(t.pnlNet) || 0;
            if (val > 0) {
                currWinRun++;
                if (currLossRun > 0) {
                    lossStreaks.push(currLossRun);
                    currLossRun = 0;
                }
            } else if (val < 0) {
                currLossRun++;
                if (currWinRun > 0) {
                    winStreaks.push(currWinRun);
                    currWinRun = 0;
                }
            } else {
                // breakeven trade - optional: ends a streak or ignores it. 
                // Let's assume it breaks both streaks for strictness.
                if (currWinRun > 0) { winStreaks.push(currWinRun); currWinRun = 0; }
                if (currLossRun > 0) { lossStreaks.push(currLossRun); currLossRun = 0; }
            }
        }
        // Push any remaining active streaks at the end of the array loop
        if (currWinRun > 0) winStreaks.push(currWinRun);
        if (currLossRun > 0) lossStreaks.push(currLossRun);

        const avgWinStreak = winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0;
        const avgLossStreak = lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length : 0;

        return {
            breakdown,
            tradeDistribution,
            winRateBySetup,
            symbolPerformance,
            weeklyDistribution,
            monthlyDistribution,
            durationDistribution,
            sessionPerformance,
            totalPnl,
            winRate,
            profitFactor,
            averageRR,
            expectancy,
            winningTrades,
            losingTrades,
            totalTrades,
            averageWin: avgWin,
            averageLoss: avgLoss,
            largestWin,
            largestLoss,
            maxConsecutiveWins,
            maxConsecutiveLosses,
            bestWeek,
            worstWeek,
            bestMonth,
            worstMonth,
            avgWinStreak,
            avgLossStreak,
            dailyPnl,
            hourlyPnl,
            avgDailyPnl,
            avgWinningDay,
            avgLosingDay,
            largestProfitableDay,
            largestLosingDay,
            maxConsecutiveWinningDays,
            maxConsecutiveLosingDays,
            openTrades,
            totalDays: dailyPnl.length,
            totalFees,
        };
    }

    async getEquityCurve(userId: string) {
        const trades = await this.prisma.trade.findMany({
            where: { userId, status: 'CLOSED' },
            orderBy: { exitDate: 'asc' },
        });

        let cumulative = 0;
        const dailyMap = new Map<string, number>();

        for (const t of trades) {
            cumulative += Number(t.pnlNet) || 0;
            const day = new Date(t.exitDate ?? t.entryDate).toISOString().split('T')[0];
            dailyMap.set(day, cumulative);
        }

        return Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, equity]) => ({ date, equity }));
    }
}
