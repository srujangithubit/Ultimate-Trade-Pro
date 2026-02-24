/**
 * mt5StatsAdapter.ts
 *
 * Converts raw MT5 positions + closed-trade history into the same
 * data shapes that the Journal-analytics components expect, so
 * the Accounts tab in Analytics can reuse every chart/widget.
 */

import type { MT5TradePosition, MT5ClosedTrade } from '@/lib/types/mt5';

// ─── helpers ───────────────────────────────────────────────

function getSession(unix: number): string {
  const h = new Date(unix * 1000).getUTCHours();
  if (h >= 0 && h < 8) return 'Asian';
  if (h >= 8 && h < 13) return 'London';
  if (h >= 13 && h < 21) return 'New York';
  return 'Asian';
}

const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toDateStr(unix: number): string {
  const d = new Date(unix * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function durationMinutes(entryUnix: number, exitUnix: number): number {
  return (exitUnix - entryUnix) / 60;
}

function durationBucket(mins: number): string {
  if (mins < 5) return '0-5 min';
  if (mins < 15) return '5-15 min';
  if (mins < 30) return '15-30 min';
  if (mins < 60) return '30-60 min';
  if (mins < 240) return '1-4 hr';
  if (mins < 1440) return '4-24 hr';
  return '24+ hr';
}

// ─── streak helpers ────────────────────────────────────────

function computeStreaks(sorted: MT5ClosedTrade[]) {
  let maxConsWins = 0, maxConsLosses = 0;
  let curWins = 0, curLosses = 0;
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];

  for (const t of sorted) {
    if (t.profit > 0) {
      curWins++;
      if (curLosses > 0) lossStreaks.push(curLosses);
      curLosses = 0;
      maxConsWins = Math.max(maxConsWins, curWins);
    } else if (t.profit < 0) {
      curLosses++;
      if (curWins > 0) winStreaks.push(curWins);
      curWins = 0;
      maxConsLosses = Math.max(maxConsLosses, curLosses);
    } else {
      if (curWins > 0) winStreaks.push(curWins);
      if (curLosses > 0) lossStreaks.push(curLosses);
      curWins = 0;
      curLosses = 0;
    }
  }
  if (curWins > 0) winStreaks.push(curWins);
  if (curLosses > 0) lossStreaks.push(curLosses);

  const avgWinStreak = winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0;
  const avgLossStreak = lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length : 0;

  return { maxConsWins, maxConsLosses, avgWinStreak, avgLossStreak };
}

function buildDirectionStats(trades: MT5ClosedTrade[]) {
  const wins = trades.filter(t => t.profit > 0);
  const losses = trades.filter(t => t.profit < 0);
  const totalGrossProfit = wins.reduce((s, t) => s + t.profit, 0);
  const totalGrossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  const streaks = computeStreaks([...trades].sort((a, b) => a.exit_time - b.exit_time));

  const winDurations = wins.map(t => durationMinutes(t.entry_time, t.exit_time));
  const lossDurations = losses.map(t => durationMinutes(t.entry_time, t.exit_time));

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    bestWin: wins.length > 0 ? Math.max(...wins.map(t => t.profit)) : 0,
    worstLoss: losses.length > 0 ? Math.min(...losses.map(t => t.profit)) : 0,
    averageWin: wins.length > 0 ? totalGrossProfit / wins.length : 0,
    averageLoss: losses.length > 0 ? totalGrossLoss / losses.length : 0,
    avgWinDuration: winDurations.length > 0 ? winDurations.reduce((a, b) => a + b, 0) / winDurations.length : 0,
    avgLossDuration: lossDurations.length > 0 ? lossDurations.reduce((a, b) => a + b, 0) / lossDurations.length : 0,
    avgWinStreak: streaks.avgWinStreak,
    avgLossStreak: streaks.avgLossStreak,
    maxWinStreak: streaks.maxConsWins,
    maxLossStreak: streaks.maxConsLosses,
  };
}

// ─── main adapter ──────────────────────────────────────────

export function buildMT5AnalyticsData(
  positions: MT5TradePosition[],
  history: MT5ClosedTrade[],
) {
  const sorted = [...history].sort((a, b) => a.exit_time - b.exit_time);
  const wins = history.filter(t => t.profit > 0);
  const losses = history.filter(t => t.profit < 0);

  const totalPnl = history.reduce((s, t) => s + t.profit, 0);
  const totalGrossProfit = wins.reduce((s, t) => s + t.profit, 0);
  const totalGrossLoss = Math.abs(losses.reduce((s, t) => s + t.profit, 0));
  const profitFactor = totalGrossLoss > 0 ? totalGrossProfit / totalGrossLoss : totalGrossProfit > 0 ? Infinity : 0;

  const averageWin = wins.length > 0 ? totalGrossProfit / wins.length : 0;
  const averageLoss = losses.length > 0 ? totalGrossLoss / losses.length : 0;
  const winRate = history.length > 0 ? (wins.length / history.length) * 100 : 0;
  const expectancy = history.length > 0 ? totalPnl / history.length : 0;
  const avgRR = averageLoss > 0 ? Math.round((averageWin / averageLoss) * 10) / 10 : 0;

  const largestWin = wins.length > 0 ? Math.max(...wins.map(t => t.profit)) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses.map(t => t.profit)) : 0;

  const totalSwap = history.reduce((s, t) => s + t.swap, 0) + positions.reduce((s, p) => s + p.swap, 0);
  const totalCommission = history.reduce((s, t) => s + t.commission, 0);
  const totalFees = history.reduce((s, t) => s + (t.fee || 0), 0);

  const streaks = computeStreaks(sorted);

  // ── Daily PnL (keyed by YYYY-MM-DD) ──
  const dailyMap = new Map<string, { pnl: number; grossPnl: number; count: number }>();
  for (const t of sorted) {
    const d = toDateStr(t.exit_time);
    const e = dailyMap.get(d) || { pnl: 0, grossPnl: 0, count: 0 };
    e.pnl += t.profit;
    e.grossPnl += t.profit + (t.swap || 0) + (t.commission || 0) + (t.fee || 0);
    e.count++;
    dailyMap.set(d, e);
  }
  const dailyPnl = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    value: v.pnl,
    grossValue: v.grossPnl,
    pnl: v.pnl,
    tradeCount: v.count,
  }));

  const totalDays = dailyMap.size;
  const profitableDays = dailyPnl.filter(d => d.value > 0);
  const losingDays = dailyPnl.filter(d => d.value < 0);
  const avgDailyPnl = totalDays > 0 ? totalPnl / totalDays : 0;
  const avgWinningDay = profitableDays.length > 0 ? profitableDays.reduce((s, d) => s + d.value, 0) / profitableDays.length : 0;
  const avgLosingDay = losingDays.length > 0 ? losingDays.reduce((s, d) => s + d.value, 0) / losingDays.length : 0;
  const largestProfitableDay = profitableDays.length > 0 ? Math.max(...profitableDays.map(d => d.value)) : 0;
  const largestLosingDay = losingDays.length > 0 ? Math.min(...losingDays.map(d => d.value)) : 0;

  // Consecutive winning/losing days
  let maxConsWinDays = 0, maxConsLossDays = 0, curWD = 0, curLD = 0;
  for (const d of dailyPnl) {
    if (d.value > 0) { curWD++; curLD = 0; maxConsWinDays = Math.max(maxConsWinDays, curWD); }
    else if (d.value < 0) { curLD++; curWD = 0; maxConsLossDays = Math.max(maxConsLossDays, curLD); }
    else { curWD = 0; curLD = 0; }
  }

  // ── Equity curve ──
  let cumPnl = 0;
  const equityCurve = dailyPnl.map(d => {
    cumPnl += d.value;
    return { date: d.date, equity: Math.round(cumPnl * 100) / 100 };
  });

  // ── Hourly PnL ──
  const hourlyMap = new Map<number, { pnl: number; count: number; wins: number; losses: number }>();
  for (const t of history) {
    const h = new Date(t.entry_time * 1000).getUTCHours();
    const e = hourlyMap.get(h) || { pnl: 0, count: 0, wins: 0, losses: 0 };
    e.pnl += t.profit;
    e.count++;
    if (t.profit > 0) e.wins++;
    if (t.profit < 0) e.losses++;
    hourlyMap.set(h, e);
  }
  const hourlyPnl = Array.from({ length: 24 }, (_, hour) => {
    const v = hourlyMap.get(hour) || { pnl: 0, count: 0, wins: 0, losses: 0 };
    return { hour, pnl: v.pnl, count: v.count, wins: v.wins, losses: v.losses, winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0 };
  });

  // ── Win Rate by Setup (MT5 doesn't have setups → use symbol as approximation) ──
  const symbolMap = new Map<string, { count: number; pnl: number; wins: number; losses: number; totalProfit: number; totalLoss: number }>();
  for (const t of history) {
    const e = symbolMap.get(t.symbol) || { count: 0, pnl: 0, wins: 0, losses: 0, totalProfit: 0, totalLoss: 0 };
    e.count++;
    e.pnl += t.profit;
    if (t.profit > 0) { e.wins++; e.totalProfit += t.profit; }
    if (t.profit < 0) { e.losses++; e.totalLoss += Math.abs(t.profit); }
    symbolMap.set(t.symbol, e);
  }

  const winRateBySetup = Array.from(symbolMap.entries()).map(([setup, v]) => ({
    setup,
    winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0,
    count: v.count,
  })).sort((a, b) => b.winRate - a.winRate);

  const symbolPerformance = Array.from(symbolMap.entries()).map(([symbol, v]) => ({
    symbol,
    count: v.count,
    pnl: v.pnl,
    wins: v.wins,
    losses: v.losses,
    totalProfit: v.totalProfit,
    totalLoss: v.totalLoss,
    winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0,
    netProfitPercent: 0,
  })).sort((a, b) => b.pnl - a.pnl);

  // ── Session Performance ──
  const sessionMap = new Map<string, { netProfit: number; totalProfit: number; totalLoss: number; wins: number; losses: number; totalTrades: number }>();
  for (const t of history) {
    const session = getSession(t.entry_time);
    const e = sessionMap.get(session) || { netProfit: 0, totalProfit: 0, totalLoss: 0, wins: 0, losses: 0, totalTrades: 0 };
    e.totalTrades++;
    e.netProfit += t.profit;
    if (t.profit > 0) { e.totalProfit += t.profit; e.wins++; }
    if (t.profit < 0) { e.totalLoss += Math.abs(t.profit); e.losses++; }
    sessionMap.set(session, e);
  }
  const sessionPerformance = Array.from(sessionMap.entries()).map(([session, v]) => ({
    session,
    ...v,
    winRate: v.totalTrades > 0 ? Math.round((v.wins / v.totalTrades) * 100) : 0,
  }));

  // ── Weekday / Trade Distribution ──
  const weekdayMap = new Map<string, { wins: number; losses: number; breakeven: number; totalPnl: number; totalProfit: number; totalLoss: number }>();
  for (const t of history) {
    const day = FULL_WEEKDAYS[new Date(t.exit_time * 1000).getDay()];
    const e = weekdayMap.get(day) || { wins: 0, losses: 0, breakeven: 0, totalPnl: 0, totalProfit: 0, totalLoss: 0 };
    if (t.profit > 0) { e.wins++; e.totalProfit += t.profit; }
    else if (t.profit < 0) { e.losses++; e.totalLoss += Math.abs(t.profit); }
    else e.breakeven++;
    e.totalPnl += t.profit;
    weekdayMap.set(day, e);
  }
  const tradeDistribution = FULL_WEEKDAYS.slice(1, 6).map(day => {
    const v = weekdayMap.get(day) || { wins: 0, losses: 0, breakeven: 0, totalPnl: 0, totalProfit: 0, totalLoss: 0 };
    const totalTrades = v.wins + v.losses + v.breakeven;
    return {
      day,
      wins: v.wins,
      losses: v.losses,
      breakeven: v.breakeven,
      totalTrades,
      winRate: totalTrades > 0 ? Math.round((v.wins / totalTrades) * 100) : 0,
      totalPnl: v.totalPnl,
      totalProfit: v.totalProfit,
      totalLoss: v.totalLoss,
    };
  });

  // ── Weekly distribution ──
  const weeklyMap = new Map<string, { start: string; count: number; pnl: number; wins: number; losses: number }>();
  for (const t of sorted) {
    const d = new Date(t.exit_time * 1000);
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const key = monday.toISOString().slice(0, 10);
    const e = weeklyMap.get(key) || { start: key, count: 0, pnl: 0, wins: 0, losses: 0 };
    e.count++;
    e.pnl += t.profit;
    if (t.profit > 0) e.wins++;
    if (t.profit < 0) e.losses++;
    weeklyMap.set(key, { ...e });

    // store label keyed by start for later
    if (!weeklyMap.has(`__label__${key}`)) {
      weeklyMap.set(`__label__${key}`, { start: key, count: 0, pnl: 0, wins: 0, losses: 0 });
    }
  }
  const weeklyDistribution = Array.from(weeklyMap.entries())
    .filter(([k]) => !k.startsWith('__label__'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const m = new Date(key);
      const f = new Date(m);
      f.setDate(m.getDate() + 4);
      return {
        week: `${m.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${f.toLocaleDateString(undefined, { day: 'numeric' })}`,
        weekStart: key,
        tradeCount: v.count,
        totalPnl: v.pnl,
        wins: v.wins,
        losses: v.losses,
      };
    });

  // Best/worst week
  const bestWeek = weeklyDistribution.length > 0 ? Math.max(...weeklyDistribution.map(w => w.totalPnl)) : 0;
  const worstWeek = weeklyDistribution.length > 0 ? Math.min(...weeklyDistribution.map(w => w.totalPnl)) : 0;

  // ── Monthly distribution ──
  const monthlyMap = new Map<string, { month: string; year: number; count: number; pnl: number; wins: number; losses: number }>();
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (const t of sorted) {
    const d = new Date(t.exit_time * 1000);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const e = monthlyMap.get(key) || { month: MONTHS[d.getMonth()], year: d.getFullYear(), count: 0, pnl: 0, wins: 0, losses: 0 };
    e.count++;
    e.pnl += t.profit;
    if (t.profit > 0) e.wins++;
    if (t.profit < 0) e.losses++;
    monthlyMap.set(key, e);
  }
  const monthlyDistribution = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => ({
      month: v.month,
      year: v.year,
      tradeCount: v.count,
      totalPnl: v.pnl,
      wins: v.wins,
      losses: v.losses,
    }));

  const bestMonth = monthlyDistribution.length > 0 ? Math.max(...monthlyDistribution.map(m => m.totalPnl)) : 0;
  const worstMonth = monthlyDistribution.length > 0 ? Math.min(...monthlyDistribution.map(m => m.totalPnl)) : 0;

  // ── Duration distribution ──
  const durationMap = new Map<string, { count: number; pnl: number; wins: number; losses: number }>();
  for (const t of history) {
    const mins = durationMinutes(t.entry_time, t.exit_time);
    const bucket = durationBucket(mins);
    const e = durationMap.get(bucket) || { count: 0, pnl: 0, wins: 0, losses: 0 };
    e.count++;
    e.pnl += t.profit;
    if (t.profit > 0) e.wins++;
    if (t.profit < 0) e.losses++;
    durationMap.set(bucket, e);
  }
  const DURATION_ORDER = ['0-5 min', '5-15 min', '15-30 min', '30-60 min', '1-4 hr', '4-24 hr', '24+ hr'];
  const durationDistribution = DURATION_ORDER.map(range => {
    const v = durationMap.get(range) || { count: 0, pnl: 0, wins: 0, losses: 0 };
    return { range, ...v };
  }).filter(d => d.count > 0);

  // ── Long / Short breakdown ──
  const longs = history.filter(t => t.type === 'BUY');
  const shorts = history.filter(t => t.type === 'SELL');

  const breakdown = {
    all: buildDirectionStats(history),
    long: buildDirectionStats(longs),
    short: buildDirectionStats(shorts),
  };

  // ── stats object (superset used by DetailedStatsGrid, AdvancedStatsGrid, DailyCumulativePnLChart) ──
  const stats = {
    totalPnl,
    winRate: Math.round(winRate * 10) / 10,
    profitFactor: profitFactor === Infinity ? 999 : Math.round(profitFactor * 100) / 100,
    averageRR: avgRR,
    expectancy: Math.round(expectancy * 100) / 100,
    winningTrades: wins.length,
    losingTrades: losses.length,
    winRateBySetup,
    dailyPnl,
    hourlyPnl,
    averageWin,
    averageLoss,
    avgDailyPnl,
    largestWin,
    largestLoss,
    totalTrades: history.length,
    avgWinningDay,
    avgLosingDay: Math.abs(avgLosingDay),
    maxConsecutiveWins: streaks.maxConsWins,
    maxConsecutiveLosses: streaks.maxConsLosses,
    largestProfitableDay,
    largestLosingDay,
    maxConsecutiveWinningDays: maxConsWinDays,
    maxConsecutiveLosingDays: maxConsLossDays,
    openTrades: positions.length,
    totalDays,
    totalFees,
    totalCommission,
    totalSwap,
    tradeDistribution,
    weeklyDistribution,
    monthlyDistribution,
    durationDistribution,
    symbolPerformance,
    sessionPerformance,
    // Advanced
    bestWeek,
    worstWeek,
    bestMonth,
    worstMonth,
    avgWinStreak: streaks.avgWinStreak,
    avgLossStreak: streaks.avgLossStreak,
    maxWinStreak: streaks.maxConsWins,
    maxLossStreak: streaks.maxConsLosses,
  };

  return { stats, breakdown, equityCurve };
}
