import { api } from './client';

export interface AiActionItem {
  task: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  target: string;
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
    assetAnalysis: {
      concentrationPct: number;
      assets: Array<{ name: string; count: number; pnl: number; winRate: number; profitFactor: number }>;
      bestAsset: { name: string; pnl: number } | null;
      worstAsset: { name: string; pnl: number } | null;
    };
    sessionAnalysis: {
      bestSession: { name: string; pnl: number; winRate: number } | null;
      worstSession: { name: string; pnl: number; winRate: number } | null;
      sessions: Array<{ name: string; pnl: number; winRate: number; count: number }>;
    };
    behaviorAnalysis: {
      avgHoldTime: number;
      medianHoldTime: number;
      p90HoldTime: number;
      riskFlags: string[];
    };
  };
  ai: {
    summary: string;
    weaknesses: unknown[];
    strengths: unknown[];
    actions: unknown[];
    deepInsights?: {
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
