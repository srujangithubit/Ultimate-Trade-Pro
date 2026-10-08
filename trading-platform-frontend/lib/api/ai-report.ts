import { api } from './client';

export interface AiActionItem {
  task: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  evidence?: Record<string, unknown>;
  target: string;
}

interface BreakdownRow {
  name: string;
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  avgHoldTime: number;
  profitFactor: number;
  maxWin?: number;
  maxLoss?: number;
}

export interface AiReportResponse {
  generatedAt: string;
  filters: {
    accountId: string | null;
    sessionId: string | null;
  };
  metrics: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    riskReward: number;
    avgHoldTime: number;
    totalPnL: number;
    pnl: number;
  };
  patterns: {
    sessionPerformance: Array<{ session: string; pnl: number; count: number; avgPnl: number }>;
    overtrading: {
      isOvertrading: boolean;
      maxTradesInDay: number;
      maxTradesInHour: number;
      avgTradesPerDay: number;
    };
    losingStreaks: {
      maxLosingStreak: number;
    };
  };
  mistakes: Array<{ rule: string; issue: string; trade: { symbol: string } }>;
  deepResearch: {
    summary: {
      totalTrades: number;
      uniqueAssets: number;
      winRate: number;
      totalPnL: number;
      expectancyPerTrade: number;
      consistencyScore: number;
    };
    timeAnalysis: {
      firstTradeAt: string | null;
      lastTradeAt: string | null;
      tradingSpanHours: number;
      activeTradingHours: number;
      activeDays: number;
      tradesPerActiveDay: number;
      tradesPerActiveHour: number;
      bestHour: BreakdownRow | null;
      worstHour: BreakdownRow | null;
      bestWeekday: BreakdownRow | null;
      worstWeekday: BreakdownRow | null;
      hourBreakdown: BreakdownRow[];
      weekdayBreakdown: BreakdownRow[];
      dailyBreakdown: BreakdownRow[];
    };
    assetAnalysis: {
      concentrationPct: number;
      topAssetByCount: BreakdownRow | null;
      assets: BreakdownRow[];
      bestAsset: BreakdownRow | null;
      worstAsset: BreakdownRow | null;
    };
    sessionAnalysis: {
      bestSession: BreakdownRow | null;
      worstSession: BreakdownRow | null;
      sessions: BreakdownRow[];
    };
    behaviorAnalysis: {
      avgHoldTime: number;
      medianHoldTime: number;
      p90HoldTime: number;
      maxWinStreak: number;
      maxLossStreak: number;
      riskFlags: string[];
    };
    qualitySignals: {
      averageWin: number;
      averageLoss: number;
      payoffRatio: number;
      profitFactor: number;
      pnlStdDev: number;
      pnlP10: number;
      pnlP50: number;
      pnlP90: number;
    };
  };
  ai: {
    summary: string;
    weaknesses: unknown[];
    strengths: unknown[];
    actions: unknown[];
    deepInsights?: {
      assetInsights?: unknown[];
      timingInsights?: unknown[];
      behavioralInsights?: unknown[];
      riskInsights?: unknown[];
      executionPlan?: unknown[];
    };
    insights?: {
      crunchingNumbers?: unknown[];
      findingBlindspots?: unknown[];
      identifyingMistakes?: unknown[];
      buildingActionPlan?: unknown[];
    };
  };
  fallbackActions: AiActionItem[];
  insights: {
    buildingActionPlan: {
      aiRecommendations: unknown[];
      ruleRecommendations: AiActionItem[];
    };
  };
  journalSnapshot: {
    totalClosedTrades: number;
    topSymbols: Array<{ label: string; count: number }>;
    topSetups: Array<{ label: string; count: number }>;
    recentTrades: Array<{
      id: string;
      symbol: string;
      setup: string | null;
      closedAt: string;
      pnl: number;
      tags: string[];
    }>;
  };
  accountsSnapshot: {
    totalAccounts: number;
    connectedAccounts: number;
    totalBalance: number;
    totalEquity: number;
    accounts: Array<{
      id: string;
      name: string;
      broker: string | null;
      accountType: string;
      currency: string;
      balance: number;
      equity: number;
      active: boolean;
      status: 'CONNECTED' | 'OFFLINE';
      closedTradeCount: number;
      totalPnl: number;
    }>;
  };
}

export const aiReportApi = {
  getReport: async (params?: {
    accountId?: string;
    sessionId?: string;
  }): Promise<AiReportResponse> => {
    const { data } = await api.get<AiReportResponse>('/ai-report', {
      params,
    });
    return data;
  },
};
