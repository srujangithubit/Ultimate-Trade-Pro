export interface AiNormalizedTrade {
  symbol: string;
  result: number;
  holdTime: number;
  session: string;
  timestamp: string;
  enteredDuringNews?: boolean;
  plannedRR?: number;
  plannedHoldTime?: number;
}

export interface AiMetrics {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  riskReward: number;
  avgHoldTime: number;
  totalPnL: number;
  pnl: number;
}

export interface AiPatterns {
  sessionStats: Record<string, { pnl: number; count: number }>;
  losingStreaks: {
    maxLosingStreak: number;
    streakRanges: Array<{
      startTradeIndex: number | null;
      endTradeIndex: number;
      length: number;
    }>;
  };
  sessionPerformance: Array<{
    session: string;
    pnl: number;
    count: number;
    avgPnl: number;
  }>;
  overtrading: {
    isOvertrading: boolean;
    maxTradesInDay: number;
    maxTradesInHour: number;
    avgTradesPerDay: number;
  };
}

export interface AiMistake {
  trade: AiNormalizedTrade;
  rule: string;
  issue: string;
}

function round(value: number, digits = 2): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  const factor = 10 ** digits;
  return Math.round(num * factor) / factor;
}

function percentile(sortedValues: number[], p: number): number {
  if (!sortedValues.length) return 0;
  const index = (sortedValues.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function initBucket() {
  return {
    count: 0,
    wins: 0,
    losses: 0,
    pnl: 0,
    holdTimeSum: 0,
    grossProfit: 0,
    grossLoss: 0,
  };
}

function updateBucket(
  bucket: ReturnType<typeof initBucket>,
  tradeResult: number,
  holdTime: number,
) {
  bucket.count += 1;
  bucket.pnl += tradeResult;
  bucket.holdTimeSum += holdTime;
  if (tradeResult > 0) {
    bucket.wins += 1;
    bucket.grossProfit += tradeResult;
  } else if (tradeResult < 0) {
    bucket.losses += 1;
    bucket.grossLoss += Math.abs(tradeResult);
  }
}

function finalizeBucket(name: string, bucket: ReturnType<typeof initBucket>) {
  const avgHoldTime = bucket.count ? bucket.holdTimeSum / bucket.count : 0;
  const winRate = bucket.count ? (bucket.wins / bucket.count) * 100 : 0;
  const profitFactor = bucket.grossProfit / (bucket.grossLoss || 1);

  return {
    name,
    count: bucket.count,
    wins: bucket.wins,
    losses: bucket.losses,
    winRate: round(winRate),
    pnl: round(bucket.pnl),
    avgHoldTime: round(avgHoldTime),
    profitFactor: round(profitFactor),
  };
}

export function calculateMetrics(trades: AiNormalizedTrade[]): AiMetrics {
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result > 0);
  const losses = trades.filter((t) => t.result < 0);

  const winRate = totalTrades ? (wins.length / totalTrades) * 100 : 0;
  const grossProfit = wins.reduce((a, t) => a + t.result, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.result, 0));
  const totalHoldTime = trades.reduce(
    (a, t) => a + (Number(t.holdTime) || 0),
    0,
  );

  const averageWin = wins.length ? grossProfit / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  const pnl = grossProfit - grossLoss;

  return {
    totalTrades,
    winRate: round(winRate),
    profitFactor: round(grossProfit / (grossLoss || 1)),
    riskReward: round(averageWin / (averageLoss || 1)),
    avgHoldTime: round(totalTrades ? totalHoldTime / totalTrades : 0),
    totalPnL: round(pnl),
    pnl: round(pnl),
  };
}

export function detectPatterns(trades: AiNormalizedTrade[]): AiPatterns {
  const sessionStats: Record<string, { pnl: number; count: number }> = {};
  const dayCounts: Record<string, number> = {};
  const hourCounts: Record<string, number> = {};

  let currentLosingStreak = 0;
  let maxLosingStreak = 0;
  const streakRanges: Array<{
    startTradeIndex: number | null;
    endTradeIndex: number;
    length: number;
  }> = [];
  let streakStartIndex: number | null = null;

  trades.forEach((trade, index) => {
    if (!sessionStats[trade.session]) {
      sessionStats[trade.session] = { pnl: 0, count: 0 };
    }
    sessionStats[trade.session].pnl += trade.result;
    sessionStats[trade.session].count += 1;

    const date = new Date(trade.timestamp);
    if (!Number.isNaN(date.getTime())) {
      const dayKey = date.toISOString().slice(0, 10);
      const hourKey = date.toISOString().slice(0, 13);
      dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
      hourCounts[hourKey] = (hourCounts[hourKey] || 0) + 1;
    }

    if ((Number(trade.result) || 0) < 0) {
      currentLosingStreak += 1;
      if (streakStartIndex === null) {
        streakStartIndex = index;
      }
    } else {
      if (currentLosingStreak >= 2) {
        streakRanges.push({
          startTradeIndex: streakStartIndex,
          endTradeIndex: index - 1,
          length: currentLosingStreak,
        });
      }
      maxLosingStreak = Math.max(maxLosingStreak, currentLosingStreak);
      currentLosingStreak = 0;
      streakStartIndex = null;
    }
  });

  maxLosingStreak = Math.max(maxLosingStreak, currentLosingStreak);
  if (currentLosingStreak >= 2) {
    streakRanges.push({
      startTradeIndex: streakStartIndex,
      endTradeIndex: trades.length - 1,
      length: currentLosingStreak,
    });
  }

  const sessionPerformance = Object.entries(sessionStats).map(
    ([session, stats]) => ({
      session,
      pnl: round(stats.pnl),
      count: stats.count,
      avgPnl: round(stats.count ? stats.pnl / stats.count : 0),
    }),
  );

  const dayValues = Object.values(dayCounts);
  const hourValues = Object.values(hourCounts);

  return {
    sessionStats,
    losingStreaks: {
      maxLosingStreak,
      streakRanges,
    },
    sessionPerformance,
    overtrading: {
      isOvertrading:
        (dayValues.length ? Math.max(...dayValues) : 0) >= 15 ||
        (hourValues.length ? Math.max(...hourValues) : 0) >= 4 ||
        (dayValues.length ? trades.length / dayValues.length : 0) >= 10,
      maxTradesInDay: dayValues.length ? Math.max(...dayValues) : 0,
      maxTradesInHour: hourValues.length ? Math.max(...hourValues) : 0,
      avgTradesPerDay: round(
        dayValues.length ? trades.length / dayValues.length : 0,
      ),
    },
  };
}

export function detectMistakes(trades: AiNormalizedTrade[]): AiMistake[] {
  const mistakes: AiMistake[] = [];

  trades.forEach((trade) => {
    const holdTime = Number(trade.holdTime) || 0;
    const result = Number(trade.result) || 0;
    const plannedHold = Number(trade.plannedHoldTime) || 0;
    const plannedRR = Number(trade.plannedRR) || 0;

    if (trade.enteredDuringNews) {
      mistakes.push({
        trade,
        rule: 'enteredDuringNews',
        issue: 'Entered during high-impact news',
      });
    }

    const closedEarly =
      plannedHold > 0
        ? holdTime < plannedHold * 0.6
        : holdTime < 2 && result > 0;

    if (closedEarly) {
      mistakes.push({
        trade,
        rule: 'closedEarly',
        issue: 'Closed early before thesis matured',
      });
    }

    if (plannedRR > 0 && plannedRR < 1.2) {
      mistakes.push({
        trade,
        rule: 'wrongRR',
        issue: 'Low planned risk:reward setup',
      });
    }

    if (holdTime < 2 && result < 0) {
      mistakes.push({
        trade,
        rule: 'impulseEntry',
        issue: 'Impulse trade / volatility entry',
      });
    }
  });

  return mistakes;
}

export function buildDeepResearch(trades: AiNormalizedTrade[]) {
  const totalTrades = trades.length;
  const assetBuckets: Record<string, ReturnType<typeof initBucket>> = {};
  const sessionBuckets: Record<string, ReturnType<typeof initBucket>> = {};
  const hourBuckets: Record<string, ReturnType<typeof initBucket>> = {};

  const holdTimes: number[] = [];
  const pnlValues: number[] = [];

  let wins = 0;
  let losses = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let pnlSum = 0;
  let holdTimeSum = 0;

  for (const trade of trades) {
    const symbol = (trade.symbol || 'UNKNOWN').toUpperCase();
    const session = trade.session || 'Unknown';
    const result = Number(trade.result) || 0;
    const holdTime = Math.max(0, Number(trade.holdTime) || 0);

    holdTimes.push(holdTime);
    pnlValues.push(result);
    pnlSum += result;
    holdTimeSum += holdTime;

    if (result > 0) {
      wins += 1;
      grossProfit += result;
    } else if (result < 0) {
      losses += 1;
      grossLoss += Math.abs(result);
    }

    if (!assetBuckets[symbol]) assetBuckets[symbol] = initBucket();
    if (!sessionBuckets[session]) sessionBuckets[session] = initBucket();

    updateBucket(assetBuckets[symbol], result, holdTime);
    updateBucket(sessionBuckets[session], result, holdTime);

    const date = new Date(trade.timestamp);
    if (!Number.isNaN(date.getTime())) {
      const hour = String(date.getUTCHours()).padStart(2, '0');
      if (!hourBuckets[hour]) hourBuckets[hour] = initBucket();
      updateBucket(hourBuckets[hour], result, holdTime);
    }
  }

  const assetRows = Object.entries(assetBuckets)
    .map(([name, bucket]) => finalizeBucket(name, bucket))
    .sort((a, b) => b.count - a.count);

  const sessionRows = Object.entries(sessionBuckets)
    .map(([name, bucket]) => finalizeBucket(name, bucket))
    .sort((a, b) => b.pnl - a.pnl);

  const hourRows = Object.entries(hourBuckets)
    .map(([name, bucket]) => finalizeBucket(`${name}:00 UTC`, bucket))
    .sort(
      (a, b) =>
        Number.parseInt(a.name.slice(0, 2), 10) -
        Number.parseInt(b.name.slice(0, 2), 10),
    );

  const topAssetByCount = assetRows[0] || null;
  const concentrationPct =
    totalTrades && topAssetByCount
      ? (topAssetByCount.count / totalTrades) * 100
      : 0;

  const sortedHoldTimes = [...holdTimes].sort((a, b) => a - b);
  const sortedPnL = [...pnlValues].sort((a, b) => a - b);

  const avgWin = wins ? grossProfit / wins : 0;
  const avgLoss = losses ? grossLoss / losses : 0;

  const riskFlags: string[] = [];
  if (concentrationPct > 55 && topAssetByCount) {
    riskFlags.push(
      `High concentration in ${topAssetByCount.name} (${round(concentrationPct)}%).`,
    );
  }
  if (totalTrades > 0 && totalTrades >= 20 && (wins / totalTrades) * 100 < 40) {
    riskFlags.push('Win rate is below 40% over meaningful sample size.');
  }

  return {
    summary: {
      totalTrades,
      uniqueAssets: assetRows.length,
      winRate: round(totalTrades ? (wins / totalTrades) * 100 : 0),
      totalPnL: round(pnlSum),
      expectancyPerTrade: round(totalTrades ? pnlSum / totalTrades : 0),
      consistencyScore: round(
        Math.max(
          0,
          Math.min(
            100,
            0.5 * (totalTrades ? (wins / totalTrades) * 100 : 0) +
              25 * Math.min(avgWin / (avgLoss || 1), 3),
          ),
        ),
      ),
    },
    timeAnalysis: {
      bestHour: [...hourRows].sort((a, b) => b.pnl - a.pnl)[0] || null,
      worstHour: [...hourRows].sort((a, b) => a.pnl - b.pnl)[0] || null,
      hourBreakdown: hourRows,
    },
    assetAnalysis: {
      concentrationPct: round(concentrationPct),
      topAssetByCount,
      bestAsset: [...assetRows].sort((a, b) => b.pnl - a.pnl)[0] || null,
      worstAsset: [...assetRows].sort((a, b) => a.pnl - b.pnl)[0] || null,
      assets: assetRows,
    },
    sessionAnalysis: {
      bestSession: sessionRows[0] || null,
      worstSession: sessionRows[sessionRows.length - 1] || null,
      sessions: sessionRows,
    },
    behaviorAnalysis: {
      avgHoldTime: round(totalTrades ? holdTimeSum / totalTrades : 0),
      medianHoldTime: round(percentile(sortedHoldTimes, 0.5)),
      p90HoldTime: round(percentile(sortedHoldTimes, 0.9)),
      riskFlags,
    },
    qualitySignals: {
      averageWin: round(avgWin),
      averageLoss: round(avgLoss),
      payoffRatio: round(avgWin / (avgLoss || 1)),
      profitFactor: round(grossProfit / (grossLoss || 1)),
      pnlP10: round(percentile(sortedPnL, 0.1)),
      pnlP50: round(percentile(sortedPnL, 0.5)),
      pnlP90: round(percentile(sortedPnL, 0.9)),
    },
  };
}

export function generateActionPlan(
  metrics: AiMetrics,
  deepResearch: ReturnType<typeof buildDeepResearch>,
  patterns: AiPatterns,
  mistakes: AiMistake[],
) {
  const ruleCount = mistakes.reduce<Record<string, number>>((acc, item) => {
    acc[item.rule] = (acc[item.rule] || 0) + 1;
    return acc;
  }, {});

  const actions: Array<{
    task: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
    target: string;
  }> = [];

  if ((metrics.profitFactor || 0) < 1.3) {
    actions.push({
      task: 'Increase setup quality filter',
      priority: 'high',
      reason: `Profit factor is ${round(metrics.profitFactor)} (target >= 1.3).`,
      target: 'Raise profit factor to >= 1.3 over next 30 closed trades.',
    });
  }

  if (
    (deepResearch.assetAnalysis.concentrationPct || 0) > 50 &&
    deepResearch.assetAnalysis.topAssetByCount
  ) {
    actions.push({
      task: 'Reduce single-asset concentration',
      priority: 'medium',
      reason: `${deepResearch.assetAnalysis.topAssetByCount.name} dominates execution share.`,
      target: 'Keep any single symbol below 40% of total trades.',
    });
  }

  if (patterns.overtrading.isOvertrading) {
    actions.push({
      task: 'Throttle execution frequency',
      priority: 'high',
      reason: 'Overtrading signal detected in daily/hourly density.',
      target: 'Limit to <= 10 trades/day and <= 3 trades/hour.',
    });
  }

  if ((patterns.losingStreaks.maxLosingStreak || 0) >= 2) {
    actions.push({
      task: 'Activate losing-streak kill switch',
      priority: 'high',
      reason: `Max losing streak reached ${patterns.losingStreaks.maxLosingStreak}.`,
      target: 'Pause after 2 losses and resume only after checklist pass.',
    });
  }

  if ((ruleCount.enteredDuringNews || 0) > 0) {
    actions.push({
      task: 'Block high-impact news entries',
      priority: 'high',
      reason: `${ruleCount.enteredDuringNews} trades were entered during news windows.`,
      target: 'Zero high-impact news entries over next 20 trades.',
    });
  }

  if (actions.length === 0) {
    actions.push({
      task: 'Maintain process with weekly review',
      priority: 'low',
      reason: 'No critical risk signals triggered for current sample.',
      target: 'Sustain metrics while growing sample quality.',
    });
  }

  return actions;
}

export function buildInsights(params: {
  metrics: AiMetrics;
  patterns: AiPatterns;
  mistakes: AiMistake[];
  fallbackActions: ReturnType<typeof generateActionPlan>;
  ai: {
    actions?: unknown[];
    deepInsights?: { executionPlan?: unknown[] };
  };
}) {
  const mistakeRuleCounts = params.mistakes.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.rule] = (acc[item.rule] || 0) + 1;
      return acc;
    },
    {},
  );

  return {
    crunchingNumbers: {
      totalPnL: round(params.metrics.totalPnL ?? params.metrics.pnl),
      winRate: round(params.metrics.winRate),
      profitFactor: round(params.metrics.profitFactor),
      riskReward: round(params.metrics.riskReward),
      avgHoldTime: round(params.metrics.avgHoldTime),
    },
    findingBlindspots: {
      losingStreaks: params.patterns.losingStreaks,
      sessionBasedPerformance: params.patterns.sessionPerformance,
      overtrading: params.patterns.overtrading,
    },
    identifyingMistakes: {
      enteredDuringNews: mistakeRuleCounts.enteredDuringNews || 0,
      closedEarly: mistakeRuleCounts.closedEarly || 0,
      wrongRR: mistakeRuleCounts.wrongRR || 0,
      allMistakes: params.mistakes,
    },
    buildingActionPlan: {
      ruleRecommendations: params.fallbackActions,
      aiRecommendations: [
        ...(Array.isArray(params.ai.actions) ? params.ai.actions : []),
        ...(Array.isArray(params.ai.deepInsights?.executionPlan)
          ? params.ai.deepInsights.executionPlan
          : []),
      ],
    },
  };
}

export function buildFallbackAi(
  metrics: AiMetrics,
  patterns: AiPatterns,
  deepResearch: ReturnType<typeof buildDeepResearch>,
  mistakes: AiMistake[],
  fallbackActions: ReturnType<typeof generateActionPlan>,
) {
  const mistakeCount = mistakes.reduce<Record<string, number>>((acc, m) => {
    acc[m.rule] = (acc[m.rule] || 0) + 1;
    return acc;
  }, {});

  return {
    summary: `Win rate ${round(metrics.winRate)}%, total PnL ${round(metrics.totalPnL)}, profit factor ${round(metrics.profitFactor)}.`,
    weaknesses: [
      metrics.profitFactor < 1.3 ? 'Profit factor below 1.3 threshold.' : null,
      patterns.overtrading.isOvertrading
        ? 'Execution frequency signals overtrading.'
        : null,
      deepResearch.assetAnalysis.concentrationPct > 50
        ? 'Single-symbol concentration risk is elevated.'
        : null,
    ].filter(Boolean),
    strengths: [
      deepResearch.sessionAnalysis.bestSession
        ? `Best session: ${deepResearch.sessionAnalysis.bestSession.name}`
        : null,
      deepResearch.assetAnalysis.bestAsset
        ? `Best symbol: ${deepResearch.assetAnalysis.bestAsset.name}`
        : null,
    ].filter(Boolean),
    actions: fallbackActions.map((a) => `${a.task}: ${a.target}`),
    insights: {
      crunchingNumbers: [
        `Total PnL: ${round(metrics.totalPnL)}`,
        `Win Rate: ${round(metrics.winRate)}%`,
        `Profit Factor: ${round(metrics.profitFactor)}`,
        `Risk:Reward: ${round(metrics.riskReward)}`,
      ],
      findingBlindspots: [
        `Max losing streak: ${patterns.losingStreaks.maxLosingStreak}`,
        `Overtrading: ${patterns.overtrading.isOvertrading ? 'Yes' : 'No'}`,
      ],
      identifyingMistakes: [
        `Entered during news: ${mistakeCount.enteredDuringNews || 0}`,
        `Closed early: ${mistakeCount.closedEarly || 0}`,
        `Wrong RR setups: ${mistakeCount.wrongRR || 0}`,
      ],
      buildingActionPlan: fallbackActions.map(
        (a) => `${a.priority.toUpperCase()}: ${a.task}`,
      ),
    },
    deepInsights: {
      assetInsights: deepResearch.assetAnalysis.assets.slice(0, 5),
      timingInsights: deepResearch.timeAnalysis.hourBreakdown.slice(0, 6),
      behavioralInsights: [deepResearch.behaviorAnalysis],
      riskInsights: deepResearch.behaviorAnalysis.riskFlags.map(
        (risk: string) => ({ risk }),
      ),
      executionPlan: fallbackActions.map((a) => `${a.task} -> ${a.target}`),
    },
  };
}
