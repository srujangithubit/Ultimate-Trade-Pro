import { Injectable } from '@nestjs/common';
import { TradeData } from '../interfaces/trade-data.interface';

@Injectable()
export class MetricsCalculator {
  calculateWinRate(trades: TradeData[]): number {
    const validTrades = trades.filter((t) => t.pnlNet !== 0);
    if (validTrades.length === 0) return 0;

    const wins = validTrades.filter((t) => t.pnlNet > 0).length;
    return (wins / validTrades.length) * 100;
  }

  calculateAverageWin(trades: TradeData[]): number {
    const winners = trades.filter((t) => t.pnlNet > 0);
    if (winners.length === 0) return 0;

    return winners.reduce((sum, t) => sum + t.pnlNet, 0) / winners.length;
  }

  calculateAverageLoss(trades: TradeData[]): number {
    const losers = trades.filter((t) => t.pnlNet < 0);
    if (losers.length === 0) return 0;

    return losers.reduce((sum, t) => sum + t.pnlNet, 0) / losers.length;
  }

  calculateProfitFactor(trades: TradeData[]): number {
    const grossProfit = trades
      .filter((t) => t.pnlNet > 0)
      .reduce((sum, t) => sum + t.pnlNet, 0);

    const grossLoss = Math.abs(
      trades.filter((t) => t.pnlNet < 0).reduce((sum, t) => sum + t.pnlNet, 0),
    );

    if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;

    return grossProfit / grossLoss;
  }

  calculateExpectancy(trades: TradeData[]): number {
    if (trades.length === 0) return 0;

    const winRate = this.calculateWinRate(trades) / 100;
    const avgWin = this.calculateAverageWin(trades);
    const avgLoss = Math.abs(this.calculateAverageLoss(trades));

    return winRate * avgWin - (1 - winRate) * avgLoss;
  }

  calculateAverageRiskReward(trades: TradeData[]): number {
    const tradesWithRR = trades.filter((t) => t.riskRewardRatio);
    if (tradesWithRR.length === 0) return 0;

    return (
      tradesWithRR.reduce((sum, t) => sum + (t.riskRewardRatio || 0), 0) /
      tradesWithRR.length
    );
  }

  calculateMaxConsecutiveWins(trades: TradeData[]): number {
    let maxWins = 0;
    let currentWins = 0;

    for (const trade of trades) {
      if (trade.pnlNet > 0) {
        currentWins++;
        maxWins = Math.max(maxWins, currentWins);
      } else {
        currentWins = 0;
      }
    }

    return maxWins;
  }

  calculateMaxConsecutiveLosses(trades: TradeData[]): number {
    let maxLosses = 0;
    let currentLosses = 0;

    for (const trade of trades) {
      if (trade.pnlNet < 0) {
        currentLosses++;
        maxLosses = Math.max(maxLosses, currentLosses);
      } else {
        currentLosses = 0;
      }
    }

    return maxLosses;
  }

  private getTradeDuration(trade: TradeData): number {
    if (trade.tradeDurationMinutes) return trade.tradeDurationMinutes;
    if (trade.entryDatetime && trade.exitDatetime) {
      const entry = new Date(trade.entryDatetime);
      const exit = new Date(trade.exitDatetime);
      return (exit.getTime() - entry.getTime()) / (1000 * 60); // minutes
    }
    return 0;
  }

  calculateAverageTradeDuration(trades: TradeData[]): number {
    const tradesWithDuration = trades.filter((t) => t.tradeDurationMinutes || (t.entryDatetime && t.exitDatetime));
    if (tradesWithDuration.length === 0) return 0;

    return (
      tradesWithDuration.reduce(
        (sum, t) => sum + this.getTradeDuration(t),
        0,
      ) / tradesWithDuration.length
    );
  }

  calculateAverageWinDuration(trades: TradeData[]): number {
    const wins = trades.filter((t) => t.pnlNet > 0 && (t.tradeDurationMinutes || (t.entryDatetime && t.exitDatetime)));
    if (wins.length === 0) return 0;
    return wins.reduce((sum, t) => sum + this.getTradeDuration(t), 0) / wins.length;
  }

  calculateAverageLossDuration(trades: TradeData[]): number {
    const losses = trades.filter((t) => t.pnlNet < 0 && (t.tradeDurationMinutes || (t.entryDatetime && t.exitDatetime)));
    if (losses.length === 0) return 0;
    return losses.reduce((sum, t) => sum + this.getTradeDuration(t), 0) / losses.length;
  }



  calculateWinRateBySetup(trades: TradeData[]): {
    setup: string;
    winRate: number;
    totalTrades: number;
  }[] {
    const tradesBySetup: Record<string, TradeData[]> = {};

    for (const trade of trades) {
      if (trade.setup) {
        if (!tradesBySetup[trade.setup]) {
          tradesBySetup[trade.setup] = [];
        }
        tradesBySetup[trade.setup].push(trade);
      }
    }

    return Object.entries(tradesBySetup)
      .map(([setup, setupTrades]) => {
        const winRate = this.calculateWinRate(setupTrades);
        return {
          setup,
          winRate,
          totalTrades: setupTrades.filter(t => t.pnlNet !== 0).length, // Align count with winrate? Or show full volume? Showing "relevant" volume seems safer to match the %
        };
      })
      .sort((a, b) => b.winRate - a.winRate);
  }

  calculateDailyPnL(trades: TradeData[]): { date: string; value: number; grossValue: number; tradeCount: number }[] {
    const statsByDate: Record<string, { pnl: number; grossPnl: number; count: number }> = {};

    for (const trade of trades) {
      if (trade.exitDatetime) {
        const dateStr = trade.exitDatetime.toISOString().split('T')[0];
        if (!statsByDate[dateStr]) {
          statsByDate[dateStr] = { pnl: 0, grossPnl: 0, count: 0 };
        }
        statsByDate[dateStr].pnl += trade.pnlNet;
        statsByDate[dateStr].grossPnl += (trade.pnlGross || trade.pnlNet); // Fallback if gross missing
        statsByDate[dateStr].count += 1;
      }
    }

    return Object.entries(statsByDate)
      .map(([date, stats]) => ({
        date,
        value: stats.pnl,
        grossValue: stats.grossPnl,
        tradeCount: stats.count
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  calculateHourlyPnL(trades: TradeData[]): {
    hour: number;
    pnl: number;
    count: number;
    wins: number;
    losses: number;
    winRate: number;
  }[] {
    const statsByHour: Record<number, { pnl: number; count: number; wins: number; losses: number }> = {};

    // Initialize all hours with 0
    for (let i = 0; i < 24; i++) {
      statsByHour[i] = { pnl: 0, count: 0, wins: 0, losses: 0 };
    }

    for (const trade of trades) {
      if (trade.entryDatetime) { // Allow trades without pnlNet (e.g. open trades?) typically strictly closed trades for analytics
        const hour = new Date(trade.entryDatetime).getUTCHours();

        statsByHour[hour].count++;
        statsByHour[hour].pnl += (trade.pnlNet || 0);

        if ((trade.pnlNet || 0) > 0) statsByHour[hour].wins++;
        if ((trade.pnlNet || 0) < 0) statsByHour[hour].losses++;
      }
    }

    return Object.entries(statsByHour)
      .map(([hourStr, stat]) => ({
        hour: parseInt(hourStr),
        pnl: stat.pnl,
        count: stat.count,
        wins: stat.wins,
        losses: stat.losses,
        winRate: stat.count > 0 ? (stat.wins / stat.count) * 100 : 0
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  calculateDailyStats(dailyPnl: { date: string; value: number }[]) {
    if (dailyPnl.length === 0) {
      return {
        avgDailyPnl: 0,
        avgWinningDay: 0,
        avgLosingDay: 0,
        largestProfitableDay: 0,
        largestLosingDay: 0,
        maxConsecutiveWinningDays: 0,
        maxConsecutiveLosingDays: 0,
        totalDays: 0,
        winningDays: 0,
        losingDays: 0,
      };
    }

    const values = dailyPnl.map(d => d.value);
    const winningDays = values.filter(v => v > 0);
    const losingDays = values.filter(v => v < 0);

    const avgDailyPnl = values.reduce((sum, v) => sum + v, 0) / values.length;
    const avgWinningDay = winningDays.length > 0 ? winningDays.reduce((sum, v) => sum + v, 0) / winningDays.length : 0;
    const avgLosingDay = losingDays.length > 0 ? losingDays.reduce((sum, v) => sum + v, 0) / losingDays.length : 0;

    const largestProfitableDay = Math.max(0, ...values);
    const largestLosingDay = Math.min(0, ...values);

    const { maxWins, maxLosses } = this.calculateConsecutiveDays(values);

    return {
      avgDailyPnl,
      avgWinningDay,
      avgLosingDay,
      largestProfitableDay,
      largestLosingDay,
      maxConsecutiveWinningDays: maxWins,
      maxConsecutiveLosingDays: maxLosses,
      totalDays: values.length,
      winningDays: winningDays.length,
      losingDays: losingDays.length,
    };
  }

  private calculateConsecutiveDays(values: number[]): { maxWins: number; maxLosses: number } {
    let maxWins = 0;
    let currentWins = 0;
    let maxLosses = 0;
    let currentLosses = 0;

    for (const val of values) {
      if (val > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else if (val < 0) {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      } else {
        currentWins = 0;
        currentLosses = 0;
      }
    }
    return { maxWins, maxLosses };
  }

  calculateTradeDistributionByDay(trades: TradeData[]): {
    day: string;
    wins: number;
    losses: number;
    breakeven: number;
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    totalProfit: number;
    totalLoss: number;
  }[] {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const distribution = days.map(day => ({
      day,
      wins: 0,
      losses: 0,
      breakeven: 0,
      totalTrades: 0,
      winRate: 0,
      totalPnl: 0,
      totalProfit: 0,
      totalLoss: 0
    }));

    console.log(`[MetricsCalculator] Calculating distribution for ${trades.length} trades`);

    for (const trade of trades) {
      if (trade.entryDatetime && trade.exitDatetime) {
        const date = new Date(trade.entryDatetime); // Group by ENTRY day
        const dayIndex = date.getDay(); // Use local system time

        distribution[dayIndex].totalTrades++;
        const pnl = Number(trade.pnlNet);
        distribution[dayIndex].totalPnl += pnl;

        if (pnl > 0) {
          distribution[dayIndex].wins++;
          distribution[dayIndex].totalProfit += pnl;
        } else if (pnl < 0) {
          distribution[dayIndex].losses++;
          distribution[dayIndex].totalLoss += Math.abs(pnl);
        } else {
          distribution[dayIndex].breakeven++;
        }
      }
    }

    // Calculate Win Rate
    const result = distribution.map(d => ({
      ...d,
      winRate: d.totalTrades > 0 ? (d.wins / d.totalTrades) * 100 : 0
    }));
    return result;
  }

  calculateWeeklyDistribution(trades: TradeData[]): {
    week: string; // "Feb 9 - 15" format
    weekStart: string; // ISO date for sorting
    tradeCount: number;
    totalPnl: number;
    wins: number;
    losses: number;
  }[] {
    const statsByWeek: Record<string, { count: number; pnl: number; wins: number; losses: number; startDate: Date }> = {};

    for (const trade of trades) {
      if (trade.exitDatetime) {
        const date = new Date(trade.exitDatetime);

        // Find Sunday of the week
        const sunday = new Date(date);
        sunday.setDate(date.getDate() - date.getDay());
        sunday.setHours(0, 0, 0, 0);

        const weekKey = sunday.toISOString().split('T')[0];

        if (!statsByWeek[weekKey]) {
          statsByWeek[weekKey] = { count: 0, pnl: 0, wins: 0, losses: 0, startDate: sunday };
        }

        statsByWeek[weekKey].count++;
        statsByWeek[weekKey].pnl += trade.pnlNet;

        if (trade.pnlNet > 0) statsByWeek[weekKey].wins++;
        if (trade.pnlNet < 0) statsByWeek[weekKey].losses++;
      }
    }

    // Format output
    return Object.values(statsByWeek)
      .map(stat => {
        const endOfWeek = new Date(stat.startDate);
        endOfWeek.setDate(stat.startDate.getDate() + 6);

        const startStr = stat.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = endOfWeek.getDate(); // Just the day number

        return {
          week: `${startStr} - ${endStr}`,
          weekStart: stat.startDate.toISOString(),
          tradeCount: stat.count,
          totalPnl: stat.pnl,
          wins: stat.wins,
          losses: stat.losses
        };
      })
      .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
  }


  calculateMonthlyDistribution(trades: TradeData[]): {
    month: string; // "January", "February"
    year: number;
    monthIndex: number; // 0-11 for sorting
    tradeCount: number;
    totalPnl: number;
    wins: number;
    losses: number;
  }[] {
    const statsByMonth: Record<string, { count: number; pnl: number; wins: number; losses: number; date: Date }> = {};
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Initialize all months for the current year (or range of years found)
    // To match the screenshot which shows all months "January" -> "December",
    // usually we show a rolling 12 months or just calendar months of the current year.
    // The screenshot shows a full list Jan-Dec, likely for one year or aggregated across years.
    // Given "Backtesting" context, it might be aggregated by Month of Year (Seasonality) or sequential.
    // The screenshot shows specific "February" bar, implying sequential or specific year.
    // Let's assume aggregated by Month Name for "Seasonality" if strict "Distribution by Month" 
    // BUT "Performance by Month" usually implies sequential. 
    // However, the screenshot list looks like a fixed 12-month template (Jan-Dec).
    // Let's implement it as "Seasonality" (Aggregated by Month) or "Calendar Year". 
    // If I look at the previous "Weekly", it was sequential.
    // If I look at the screenshot, "January" ... "December" are listed in order.
    // I will generate stats for all 12 months, defaulting to 0, to match the UI which likely shows empty months too.

    // 1. Initialize 0-filled for 12 months
    for (let i = 0; i < 12; i++) {
      statsByMonth[i] = { count: 0, pnl: 0, wins: 0, losses: 0, date: new Date(new Date().getFullYear(), i, 1) };
    }

    for (const trade of trades) {
      if (trade.exitDatetime) {
        const date = new Date(trade.exitDatetime);
        const monthIndex = date.getMonth();

        statsByMonth[monthIndex].count++;
        statsByMonth[monthIndex].pnl += trade.pnlNet;

        if (trade.pnlNet > 0) statsByMonth[monthIndex].wins++;
        if (trade.pnlNet < 0) statsByMonth[monthIndex].losses++;
      }
    }

    return Object.entries(statsByMonth).map(([indexStr, stat]) => ({
      month: monthNames[parseInt(indexStr)],
      year: stat.date.getFullYear(),
      monthIndex: parseInt(indexStr),
      tradeCount: stat.count,
      totalPnl: stat.pnl,
      wins: stat.wins,
      losses: stat.losses
    })).sort((a, b) => a.monthIndex - b.monthIndex);
  }

  calculateDurationDistribution(trades: TradeData[]): {
    range: string;
    count: number;
    pnl: number;
    wins: number;
    losses: number;
  }[] {
    const buckets = [
      { label: 'Under 1 min', min: 0, max: 1 },
      { label: '1min to 10mins', min: 1, max: 10 },
      { label: '10mins to 1h', min: 10, max: 60 },
      { label: '1h to 4h', min: 60, max: 240 },
      { label: '4h to 24h', min: 240, max: 1440 },
      { label: '24h to 3 days', min: 1440, max: 4320 },
      { label: '3 days to 1 week', min: 4320, max: 10080 },
      { label: '1 week to 1 month', min: 10080, max: 43200 },
      { label: '1 month +', min: 43200, max: Infinity },
    ];

    const statsByBucket = buckets.map(b => ({
      ...b,
      count: 0,
      pnl: 0,
      wins: 0,
      losses: 0
    }));

    for (const trade of trades) {
      const duration = this.getTradeDuration(trade); // in minutes

      const bucket = statsByBucket.find(b => duration >= b.min && duration < b.max);

      if (bucket) {
        bucket.count++;
        bucket.pnl += (trade.pnlNet || 0);
        if ((trade.pnlNet || 0) > 0) bucket.wins++;
        if ((trade.pnlNet || 0) < 0) bucket.losses++;
      }
    }

    return statsByBucket.map(b => ({
      range: b.label,
      count: b.count,
      pnl: b.pnl,
      wins: b.wins,
      losses: b.losses
    }));
  }

  calculateSymbolPerformance(trades: TradeData[]): {
    symbol: string;
    count: number;
    pnl: number;
    wins: number;
    losses: number;
    totalProfit: number;
    totalLoss: number;
    winRate: number;
    netProfitPercent: number;
  }[] {
    const statsBySymbol: Record<string, { count: number; pnl: number; wins: number; losses: number; totalProfit: number; totalLoss: number; totalInvested: number }> = {};

    for (const trade of trades) {
      if (trade.instrument) {
        const symbol = trade.instrument;
        if (!statsBySymbol[symbol]) {
          statsBySymbol[symbol] = { count: 0, pnl: 0, wins: 0, losses: 0, totalProfit: 0, totalLoss: 0, totalInvested: 0 };
        }

        statsBySymbol[symbol].count++;
        statsBySymbol[symbol].pnl += (trade.pnlNet || 0);

        // Track invested amount for percentage calculation
        if (trade.entryPrice && trade.quantity) {
          statsBySymbol[symbol].totalInvested += trade.entryPrice * trade.quantity;
        }

        if ((trade.pnlNet || 0) > 0) {
          statsBySymbol[symbol].wins++;
          statsBySymbol[symbol].totalProfit += trade.pnlNet;
        }
        if ((trade.pnlNet || 0) < 0) {
          statsBySymbol[symbol].losses++;
          statsBySymbol[symbol].totalLoss += Math.abs(trade.pnlNet);
        }
      }
    }

    return Object.entries(statsBySymbol)
      .map(([symbol, stats]) => ({
        symbol,
        count: stats.count,
        pnl: stats.pnl,
        wins: stats.wins,
        losses: stats.losses,
        totalProfit: stats.totalProfit,
        totalLoss: stats.totalLoss,
        winRate: stats.count > 0 ? (stats.wins / stats.count) * 100 : 0,
        netProfitPercent: stats.totalInvested > 0
          ? (stats.pnl / stats.totalInvested) * 100
          : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  calculatePeriodStats(trades: TradeData[]): {
    bestWeek: number;
    worstWeek: number;
    bestMonth: number;
    worstMonth: number;
  } {
    const weeklyPnl: Record<string, number> = {};
    const monthlyPnl: Record<string, number> = {};

    for (const trade of trades) {
      if (trade.exitDatetime) {
        const date = new Date(trade.exitDatetime);
        const year = date.getFullYear();

        // Week Calculation (Sunday start) to match standard calendar views
        // Find the Sunday of this week
        const sunday = new Date(date);
        sunday.setDate(date.getDate() - date.getDay());
        sunday.setHours(0, 0, 0, 0); // Normalize time
        const weekKey = sunday.toISOString().split('T')[0]; // Use Sunday's date as key

        const monthKey = `${year}-${date.getMonth()}`;

        // Ensure pnlNet is a number (TypeORM may return strings for float columns)
        const pnl = Number(trade.pnlNet) || 0;
        weeklyPnl[weekKey] = (weeklyPnl[weekKey] || 0) + pnl;
        monthlyPnl[monthKey] = (monthlyPnl[monthKey] || 0) + pnl;
      }
    }

    const weeks = Object.values(weeklyPnl);
    const months = Object.values(monthlyPnl);

    return {
      bestWeek: weeks.length ? Math.max(...weeks) : 0,
      worstWeek: weeks.length ? Math.min(...weeks) : 0,
      bestMonth: months.length ? Math.max(...months) : 0,
      worstMonth: months.length ? Math.min(...months) : 0,
    };
  }

  calculateStreakStats(trades: TradeData[]): {
    avgWinStreak: number;
    avgLossStreak: number;
    maxWinStreak: number;
    maxLossStreak: number;
  } {
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    const winStreaks: number[] = [];
    const lossStreaks: number[] = [];

    for (const trade of trades) {
      if (trade.pnlNet > 0) {
        if (currentLossStreak > 0) {
          lossStreaks.push(currentLossStreak);
          currentLossStreak = 0;
        }
        currentWinStreak++;
      } else if (trade.pnlNet < 0) {
        if (currentWinStreak > 0) {
          winStreaks.push(currentWinStreak);
          currentWinStreak = 0;
        }
        currentLossStreak++;
      }
    }

    // Push final streaks
    if (currentWinStreak > 0) winStreaks.push(currentWinStreak);
    if (currentLossStreak > 0) lossStreaks.push(currentLossStreak);

    const maxWinStreak = winStreaks.length ? Math.max(...winStreaks) : 0;
    const maxLossStreak = lossStreaks.length ? Math.max(...lossStreaks) : 0;

    const avgWinStreak = winStreaks.length
      ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length
      : 0;

    const avgLossStreak = lossStreaks.length
      ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length
      : 0;

    return {
      avgWinStreak,
      avgLossStreak,
      maxWinStreak,
      maxLossStreak,
    };
  }

  calculateSessionPerformance(trades: TradeData[]): {
    session: string;
    netProfit: number;
    totalProfit: number;
    totalLoss: number;
    wins: number;
    losses: number;
    totalTrades: number;
    winRate: number;
  }[] {
    // Define trading sessions converted from IST to UTC (IST = UTC+5:30)
    // Asian:  02:30 AM - 02:30 PM IST → 21:00 - 09:00 UTC (crosses midnight)
    // London: 12:30 PM - 09:30 PM IST → 07:00 - 16:00 UTC
    // NY:     06:30 PM - 03:30 AM IST → 13:00 - 22:00 UTC (crosses midnight)
    //
    // For overlapping periods, we assign by priority (most recently opened session):
    //   07:00-09:00 UTC → London (London just opened, Asian closing)
    //   13:00-16:00 UTC → NY (NY just opened, London closing)
    //   21:00-22:00 UTC → Asian (Asian just opened, NY closing)
    //
    // Non-overlapping assignment:
    //   Asian:   21:00 - 07:00 UTC
    //   London:  07:00 - 13:00 UTC
    //   NY:      13:00 - 21:00 UTC
    const sessionNames = ['London', 'NY', 'Asian', 'Outside of Sessions'];

    const stats: Record<string, { netProfit: number; totalProfit: number; totalLoss: number; wins: number; losses: number; totalTrades: number }> = {};

    // Initialize all sessions to 0
    for (const name of sessionNames) {
      stats[name] = { netProfit: 0, totalProfit: 0, totalLoss: 0, wins: 0, losses: 0, totalTrades: 0 };
    }

    for (const trade of trades) {
      if (trade.entryDatetime) {
        const hour = new Date(trade.entryDatetime).getUTCHours();

        // Assign session based on non-overlapping UTC ranges
        let sessionName: string;
        if (hour >= 13 && hour < 21) {
          sessionName = 'NY';
        } else if (hour >= 7 && hour < 13) {
          sessionName = 'London';
        } else {
          // 21:00-23:59 and 00:00-06:59 → Asian
          sessionName = 'Asian';
        }

        const pnl = trade.pnlNet || 0;
        stats[sessionName].totalTrades++;
        stats[sessionName].netProfit += pnl;

        if (pnl > 0) {
          stats[sessionName].wins++;
          stats[sessionName].totalProfit += pnl;
        } else if (pnl < 0) {
          stats[sessionName].losses++;
          stats[sessionName].totalLoss += Math.abs(pnl);
        }
      }
    }

    return sessionNames.map(name => ({
      session: name,
      netProfit: stats[name].netProfit,
      totalProfit: stats[name].totalProfit,
      totalLoss: stats[name].totalLoss,
      wins: stats[name].wins,
      losses: stats[name].losses,
      totalTrades: stats[name].totalTrades,
      winRate: stats[name].totalTrades > 0
        ? (stats[name].wins / stats[name].totalTrades) * 100
        : 0,
    }));
  }

}
