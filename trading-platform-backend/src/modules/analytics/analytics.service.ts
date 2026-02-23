import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Trade } from '../trades/entities/trade.entity';
import { MetricsCalculator } from './calculators/metrics.calculator';
import { EquityCurveCalculator } from './calculators/equity-curve.calculator';
import { DrawdownCalculator } from './calculators/drawdown.calculator';
import { TradeData } from './interfaces/trade-data.interface';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Trade)
    private tradeRepository: Repository<Trade>,
    private metricsCalculator: MetricsCalculator,
    private equityCurveCalculator: EquityCurveCalculator,
    private drawdownCalculator: DrawdownCalculator,
  ) { }

  async getOverview(userId: string, startDate?: Date, endDate?: Date) {
    const trades = await this.getTrades(userId, startDate, endDate);
    const openTradesCount = await this.tradeRepository.count({
      where: { userId, exitDatetime: IsNull() },
    });
    return this.calculateStats(trades, openTradesCount);
  }

  async getEquityCurve(userId: string, startingBalance: number = 10000) {
    const trades = await this.getTrades(userId);
    return this.equityCurveCalculator.calculate(trades, startingBalance);
  }

  async getDrawdown(userId: string, startingBalance: number = 10000) {
    const equityCurve = await this.getEquityCurve(userId, startingBalance);
    return this.drawdownCalculator.calculate(equityCurve);
  }

  calculateStats(trades: TradeData[], openTradesCount: number = 0) {
    if (trades.length === 0) {
      return this.getEmptyMetrics();
    }

    const longTrades = trades.filter(t => t.direction === 'long');
    const shortTrades = trades.filter(t => t.direction === 'short');

    const calculateStats = (tResult: TradeData[]) => {
      const stats = this.metricsCalculator.calculateDailyStats(
        this.metricsCalculator.calculateDailyPnL(tResult)
      );

      const streakStats = this.metricsCalculator.calculateStreakStats(tResult);
      const periodStats = this.metricsCalculator.calculatePeriodStats(tResult);

      return {
        totalTrades: tResult.length,
        winningTrades: tResult.filter(t => t.pnlNet > 0).length,
        losingTrades: tResult.filter(t => t.pnlNet < 0).length,
        averageWin: this.metricsCalculator.calculateAverageWin(tResult),
        averageLoss: this.metricsCalculator.calculateAverageLoss(tResult),
        bestWin: tResult.length ? Math.max(0, ...tResult.map(t => t.pnlNet)) : 0,
        worstLoss: tResult.length ? Math.min(0, ...tResult.map(t => t.pnlNet)) : 0,

        avgWinDuration: this.metricsCalculator.calculateAverageWinDuration(tResult),
        avgLossDuration: this.metricsCalculator.calculateAverageLossDuration(tResult),

        ...streakStats,
        ...periodStats
      };
    };

    return {
      totalTrades: trades.length,
      winningTrades: trades.filter((t) => t.pnlNet > 0).length,
      losingTrades: trades.filter((t) => t.pnlNet < 0).length,
      winRate: this.metricsCalculator.calculateWinRate(trades),

      totalPnl: trades.reduce((sum, t) => sum + t.pnlNet, 0),
      totalPnlGross: trades.reduce((sum, t) => sum + t.pnlGross, 0),
      totalFees: trades.reduce((sum, t) => sum + (t.fees || 0), 0),
      totalCommission: trades.reduce((sum, t) => sum + (t.commission || 0), 0),

      averageWin: this.metricsCalculator.calculateAverageWin(trades),
      averageLoss: this.metricsCalculator.calculateAverageLoss(trades),
      largestWin: trades.filter(t => t.pnlNet > 0).length ? Math.max(...trades.filter(t => t.pnlNet > 0).map((t) => t.pnlNet)) : 0,
      largestLoss: trades.filter(t => t.pnlNet < 0).length ? Math.min(...trades.filter(t => t.pnlNet < 0).map((t) => t.pnlNet)) : 0,

      profitFactor: this.metricsCalculator.calculateProfitFactor(trades),
      expectancy: this.metricsCalculator.calculateExpectancy(trades),

      averageRR: this.metricsCalculator.calculateAverageRiskReward(trades),

      maxConsecutiveWins:
        this.metricsCalculator.calculateMaxConsecutiveWins(trades),
      maxConsecutiveLosses:
        this.metricsCalculator.calculateMaxConsecutiveLosses(trades),

      averageTradeDuration:
        this.metricsCalculator.calculateAverageTradeDuration(trades),

      winRateBySetup: this.metricsCalculator.calculateWinRateBySetup(trades),
      dailyPnl: this.metricsCalculator.calculateDailyPnL(trades),
      hourlyPnl: this.metricsCalculator.calculateHourlyPnL(trades),
      durationDistribution: this.metricsCalculator.calculateDurationDistribution(trades),
      symbolPerformance: this.metricsCalculator.calculateSymbolPerformance(trades),

      openTrades: openTradesCount,
      ...this.metricsCalculator.calculateDailyStats(
        this.metricsCalculator.calculateDailyPnL(trades),
      ),
      tradeDistribution: this.metricsCalculator.calculateTradeDistributionByDay(trades),
      ...this.metricsCalculator.calculatePeriodStats(trades),
      ...this.metricsCalculator.calculateStreakStats(trades),
      weeklyDistribution: this.metricsCalculator.calculateWeeklyDistribution(trades),
      monthlyDistribution: this.metricsCalculator.calculateMonthlyDistribution(trades),
      sessionPerformance: this.metricsCalculator.calculateSessionPerformance(trades),

      // New Breakdown for Long/Short Analysis
      breakdown: {
        all: calculateStats(trades),
        long: calculateStats(longTrades),
        short: calculateStats(shortTrades)
      }
    };
  }

  // Exposed for other services (e.g. Backtesting)
  calculateEquityCurve(trades: TradeData[], startingBalance: number) {
    return this.equityCurveCalculator.calculate(trades, startingBalance);
  }

  calculateDrawdown(equityCurve: Array<{ date: Date; equity: number }>) {
    return this.drawdownCalculator.calculate(equityCurve);
  }

  private async getTrades(userId: string, startDate?: Date, endDate?: Date) {
    const query = this.tradeRepository
      .createQueryBuilder('trade')
      .where('trade.userId = :userId', { userId })
      .andWhere('trade.exitDatetime IS NOT NULL')
      .orderBy('trade.entryDatetime', 'ASC');

    if (startDate && endDate) {
      query.andWhere('trade.entryDatetime BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    return await query.getMany();
  }

  private getEmptyMetrics() {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnl: 0,
      averageWin: 0,
      averageLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      winRateBySetup: [],
      dailyPnl: [],
      hourlyPnl: [],
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
      openTrades: 0,
      tradeDistribution: [],
      bestWeek: 0,
      worstWeek: 0,
      bestMonth: 0,
      worstMonth: 0,
      avgWinStreak: 0,
      avgLossStreak: 0,
      maxWinStreak: 0,
      maxLossStreak: 0,
      weeklyDistribution: [],
      monthlyDistribution: [],
      durationDistribution: [],
      symbolPerformance: [],
      sessionPerformance: [],
    };
  }
}
