import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import {
  AiNormalizedTrade,
  buildDeepResearch,
  buildFallbackAi,
  buildInsights,
  calculateMetrics,
  detectMistakes,
  detectPatterns,
  generateActionPlan,
} from './engines';

@Injectable()
export class AiReportService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(userId: string, accountId?: string) {
    if (accountId && !this.isUuid(accountId)) {
      throw new BadRequestException('Invalid accountId format');
    }

    if (accountId) {
      const ownsAccount = await this.prisma.tradingAccount.findFirst({
        where: { id: accountId, userId },
        select: { id: true },
      });

      if (!ownsAccount) {
        throw new ForbiddenException('Account does not belong to current user');
      }
    }

    const [trades, accounts] = await Promise.all([
      this.prisma.trade.findMany({
        where: {
          userId,
          status: 'CLOSED',
          ...(accountId ? { accountId } : {}),
        },
        select: {
          id: true,
          accountId: true,
          symbol: true,
          setup: true,
          entryDate: true,
          exitDate: true,
          entryPrice: true,
          exitPrice: true,
          stopLoss: true,
          takeProfit: true,
          pnlGross: true,
          pnlNet: true,
          notes: true,
          tags: true,
          customMetrics: true,
        },
        orderBy: { entryDate: 'asc' },
      }),
      this.prisma.tradingAccount.findMany({
        where: {
          userId,
          ...(accountId ? { id: accountId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const normalizedTrades: AiNormalizedTrade[] = trades.map((trade) => {
      const entryDate = new Date(trade.entryDate);
      const exitDate = trade.exitDate ? new Date(trade.exitDate) : entryDate;
      const holdTime = Math.max(
        0,
        (exitDate.getTime() - entryDate.getTime()) / 36e5,
      );

      const rawPnl =
        this.toNumber(trade.pnlNet) || this.toNumber(trade.pnlGross);

      const customMetrics = this.toObject(trade.customMetrics);
      const plannedHoldTime = this.toNumber(customMetrics.plannedHoldTime);

      let plannedRR = this.toNumber(customMetrics.plannedRR);
      if (!plannedRR) {
        const entry = this.toNumber(trade.entryPrice);
        const sl = this.toNumber(trade.stopLoss);
        const tp = this.toNumber(trade.takeProfit);
        if (entry && sl && tp) {
          const risk = Math.abs(entry - sl);
          const reward = Math.abs(tp - entry);
          plannedRR = risk > 0 ? reward / risk : 0;
        }
      }

      const enteredDuringNews =
        this.hasNewsTag(trade.tags) ||
        (trade.notes || '').toLowerCase().includes('high impact news') ||
        (trade.notes || '').toLowerCase().includes('nfp');

      return {
        symbol: (trade.symbol || 'UNKNOWN').toUpperCase(),
        result: rawPnl,
        holdTime,
        session: this.getSessionName(exitDate),
        timestamp: exitDate.toISOString(),
        enteredDuringNews,
        plannedRR,
        plannedHoldTime,
      };
    });

    const metrics = calculateMetrics(normalizedTrades);
    const patterns = detectPatterns(normalizedTrades);
    const mistakes = detectMistakes(normalizedTrades);
    const deepResearch = buildDeepResearch(normalizedTrades);
    const fallbackActions = generateActionPlan(
      metrics,
      deepResearch,
      patterns,
      mistakes,
    );

    const ai = await this.generateAiInsights(
      metrics,
      patterns,
      mistakes,
      deepResearch,
      fallbackActions,
    );

    const insights = buildInsights({
      metrics,
      patterns,
      mistakes,
      fallbackActions,
      ai,
    });

    const accountPnlById = new Map<string, number>();
    const accountTradeCountById = new Map<string, number>();
    for (const trade of trades) {
      if (!trade.accountId) continue;
      const pnl = this.toNumber(trade.pnlNet) || this.toNumber(trade.pnlGross);
      accountPnlById.set(
        trade.accountId,
        (accountPnlById.get(trade.accountId) || 0) + pnl,
      );
      accountTradeCountById.set(
        trade.accountId,
        (accountTradeCountById.get(trade.accountId) || 0) + 1,
      );
    }

    const accountsSnapshot = {
      totalAccounts: accounts.length,
      connectedAccounts: accounts.filter((acc) => {
        if (!acc.lastSeen) return false;
        return Date.now() - new Date(acc.lastSeen).getTime() < 90_000;
      }).length,
      totalBalance: accounts.reduce(
        (sum, acc) => sum + this.toNumber(acc.balance),
        0,
      ),
      totalEquity: accounts.reduce(
        (sum, acc) => sum + this.toNumber(acc.equity),
        0,
      ),
      accounts: accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        broker: acc.broker,
        accountType: acc.accountType,
        currency: acc.currency,
        balance: this.toNumber(acc.balance),
        equity: this.toNumber(acc.equity),
        active: acc.active,
        status:
          acc.lastSeen && Date.now() - new Date(acc.lastSeen).getTime() < 90_000
            ? 'CONNECTED'
            : 'OFFLINE',
        closedTradeCount: accountTradeCountById.get(acc.id) || 0,
        totalPnl: accountPnlById.get(acc.id) || 0,
      })),
    };

    const journalSnapshot = {
      totalClosedTrades: trades.length,
      topSymbols: this.buildTopCounts(trades.map((t) => t.symbol || 'UNKNOWN')),
      topSetups: this.buildTopCounts(trades.map((t) => t.setup || 'Unlabeled')),
      recentTrades: [...trades]
        .sort(
          (a, b) =>
            new Date(b.exitDate || b.entryDate).getTime() -
            new Date(a.exitDate || a.entryDate).getTime(),
        )
        .slice(0, 10)
        .map((trade) => ({
          id: trade.id,
          symbol: trade.symbol,
          setup: trade.setup,
          closedAt: (trade.exitDate || trade.entryDate).toISOString(),
          pnl: this.toNumber(trade.pnlNet) || this.toNumber(trade.pnlGross),
          tags: trade.tags || [],
        })),
    };

    return {
      generatedAt: new Date().toISOString(),
      filters: {
        accountId: accountId || null,
      },
      metrics,
      patterns,
      mistakes,
      deepResearch,
      ai,
      fallbackActions,
      insights,
      journalSnapshot,
      accountsSnapshot,
    };
  }

  private async generateAiInsights(
    metrics: ReturnType<typeof calculateMetrics>,
    patterns: ReturnType<typeof detectPatterns>,
    mistakes: ReturnType<typeof detectMistakes>,
    deepResearch: ReturnType<typeof buildDeepResearch>,
    fallbackActions: ReturnType<typeof generateActionPlan>,
  ) {
    const fallback = buildFallbackAi(
      metrics,
      patterns,
      deepResearch,
      mistakes,
      fallbackActions,
    );

    const ollamaUrl =
      process.env.AI_REPORT_OLLAMA_URL || 'http://localhost:11434/api/generate';
    const model = process.env.AI_REPORT_OLLAMA_MODEL || 'llama3';

    const prompt = `
You are a strict trading performance coach.

Use this trading dataset summary:
- Metrics: ${JSON.stringify(metrics)}
- Patterns: ${JSON.stringify(patterns)}
- Mistakes: ${JSON.stringify(mistakes)}
- Deep Research: ${JSON.stringify(deepResearch)}

Return ONLY valid JSON with this exact shape:
{
  "summary": "",
  "weaknesses": [],
  "strengths": [],
  "actions": [],
  "insights": {
    "crunchingNumbers": [],
    "findingBlindspots": [],
    "identifyingMistakes": [],
    "buildingActionPlan": []
  },
  "deepInsights": {
    "assetInsights": [],
    "timingInsights": [],
    "behavioralInsights": [],
    "riskInsights": [],
    "executionPlan": []
  }
}
`;

    try {
      const response = await axios.post(
        ollamaUrl,
        {
          model,
          prompt,
          stream: false,
        },
        { timeout: 20_000 },
      );

      const parsed = this.parseJsonFromAiResponse(response.data?.response);
      if (!parsed || typeof parsed !== 'object') {
        return { ...fallback, raw: response.data?.response || '' };
      }

      return {
        summary: String(
          (parsed as Record<string, unknown>).summary || fallback.summary,
        ),
        weaknesses: this.toArray(
          (parsed as Record<string, unknown>).weaknesses,
          fallback.weaknesses,
        ),
        strengths: this.toArray(
          (parsed as Record<string, unknown>).strengths,
          fallback.strengths,
        ),
        actions: this.toArray(
          (parsed as Record<string, unknown>).actions,
          fallback.actions,
        ),
        insights: {
          crunchingNumbers: this.toArray(
            this.toObject((parsed as Record<string, unknown>).insights)
              .crunchingNumbers,
            fallback.insights.crunchingNumbers,
          ),
          findingBlindspots: this.toArray(
            this.toObject((parsed as Record<string, unknown>).insights)
              .findingBlindspots,
            fallback.insights.findingBlindspots,
          ),
          identifyingMistakes: this.toArray(
            this.toObject((parsed as Record<string, unknown>).insights)
              .identifyingMistakes,
            fallback.insights.identifyingMistakes,
          ),
          buildingActionPlan: this.toArray(
            this.toObject((parsed as Record<string, unknown>).insights)
              .buildingActionPlan,
            fallback.insights.buildingActionPlan,
          ),
        },
        deepInsights: {
          assetInsights: this.toArray(
            this.toObject((parsed as Record<string, unknown>).deepInsights)
              .assetInsights,
            fallback.deepInsights.assetInsights,
          ),
          timingInsights: this.toArray(
            this.toObject((parsed as Record<string, unknown>).deepInsights)
              .timingInsights,
            fallback.deepInsights.timingInsights,
          ),
          behavioralInsights: this.toArray(
            this.toObject((parsed as Record<string, unknown>).deepInsights)
              .behavioralInsights,
            fallback.deepInsights.behavioralInsights,
          ),
          riskInsights: this.toArray(
            this.toObject((parsed as Record<string, unknown>).deepInsights)
              .riskInsights,
            fallback.deepInsights.riskInsights,
          ),
          executionPlan: this.toArray(
            this.toObject((parsed as Record<string, unknown>).deepInsights)
              .executionPlan,
            fallback.deepInsights.executionPlan,
          ),
        },
      };
    } catch {
      return fallback;
    }
  }

  private parseJsonFromAiResponse(text: unknown): unknown {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();

    try {
      return JSON.parse(trimmed);
    } catch {
      // Continue with relaxed extraction.
    }

    const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      try {
        return JSON.parse(fencedMatch[1].trim());
      } catch {
        // Continue with object extraction.
      }
    }

    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const candidate = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }

    return null;
  }

  private toArray(value: unknown, fallback: unknown[]): unknown[] {
    if (Array.isArray(value) && value.length) return value;
    return fallback;
  }

  private toObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private toNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private hasNewsTag(tags: unknown): boolean {
    if (!Array.isArray(tags)) return false;
    return tags.some((tag) => {
      const text = String(tag).toLowerCase();
      return (
        text.includes('news') ||
        text.includes('nfp') ||
        text.includes('cpi') ||
        text.includes('fomc')
      );
    });
  }

  private getSessionName(timestamp: Date): string {
    const hour = timestamp.getUTCHours();
    if (hour < 8) return 'Asia';
    if (hour < 16) return 'London';
    return 'New York';
  }

  private buildTopCounts(values: string[]) {
    const counts = values.reduce<Record<string, number>>((acc, value) => {
      const key = String(value || 'Unknown').trim();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
