/**
 * MetricsCalculator - Pure utility class for computing trading analytics.
 *
 * All methods are stateless and accept an array of trade-like objects so
 * they can be used across live, paper, and backtesting contexts.
 */

export interface TradePnl {
  pnlNet: number;
}

export class MetricsCalculator {
  /**
   * Calculate win rate as a percentage (0–100).
   * A "win" is any trade with pnlNet > 0.
   */
  calculateWinRate(trades: TradePnl[]): number {
    if (trades.length === 0) return 0;
    const wins = trades.filter((t) => t.pnlNet > 0).length;
    return (wins / trades.length) * 100;
  }

  /**
   * Calculate profit factor = gross profits / |gross losses|.
   * Returns Infinity when there are no losses, 0 when there are no profits.
   */
  calculateProfitFactor(trades: TradePnl[]): number {
    if (trades.length === 0) return 0;

    const grossProfit = trades
      .filter((t) => t.pnlNet > 0)
      .reduce((sum, t) => sum + t.pnlNet, 0);

    const grossLoss = Math.abs(
      trades.filter((t) => t.pnlNet < 0).reduce((sum, t) => sum + t.pnlNet, 0),
    );

    if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
    return grossProfit / grossLoss;
  }

  /**
   * Calculate the maximum drawdown as a positive number.
   * Drawdown = peak equity − trough equity (running cumulative PnL).
   */
  calculateMaxDrawdown(trades: TradePnl[]): number {
    if (trades.length === 0) return 0;

    let peak = 0;
    let equity = 0;
    let maxDrawdown = 0;

    for (const trade of trades) {
      equity += trade.pnlNet;
      if (equity > peak) peak = equity;
      const drawdown = peak - equity;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  /**
   * Calculate annualised Sharpe ratio (assuming 252 trading days).
   * Uses average daily PnL / std-dev of daily PnL × √252.
   * When std-dev is 0, returns 0.
   */
  calculateSharpeRatio(trades: TradePnl[], riskFreeRate = 0): number {
    if (trades.length < 2) return 0;

    const returns = trades.map((t) => t.pnlNet);
    const mean =
      returns.reduce((sum, r) => sum + r, 0) / returns.length - riskFreeRate;
    const variance =
      returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
      (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;
    return (mean / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate expectancy = (win% × avgWin) − (loss% × |avgLoss|).
   */
  calculateExpectancy(trades: TradePnl[]): number {
    if (trades.length === 0) return 0;

    const winners = trades.filter((t) => t.pnlNet > 0);
    const losers = trades.filter((t) => t.pnlNet < 0);

    const winRate = winners.length / trades.length;
    const lossRate = losers.length / trades.length;

    const avgWin =
      winners.length > 0
        ? winners.reduce((s, t) => s + t.pnlNet, 0) / winners.length
        : 0;
    const avgLoss =
      losers.length > 0
        ? Math.abs(losers.reduce((s, t) => s + t.pnlNet, 0) / losers.length)
        : 0;

    return winRate * avgWin - lossRate * avgLoss;
  }

  /**
   * Calculate the average PnL per trade.
   */
  calculateAveragePnl(trades: TradePnl[]): number {
    if (trades.length === 0) return 0;
    return trades.reduce((sum, t) => sum + t.pnlNet, 0) / trades.length;
  }

  /**
   * Calculate total PnL across all trades.
   */
  calculateTotalPnl(trades: TradePnl[]): number {
    return trades.reduce((sum, t) => sum + t.pnlNet, 0);
  }

  /**
   * Generate a full analytics summary from a set of trades.
   */
  calculateSummary(trades: TradePnl[]) {
    return {
      totalTrades: trades.length,
      winRate: this.calculateWinRate(trades),
      profitFactor: this.calculateProfitFactor(trades),
      maxDrawdown: this.calculateMaxDrawdown(trades),
      sharpeRatio: this.calculateSharpeRatio(trades),
      expectancy: this.calculateExpectancy(trades),
      averagePnl: this.calculateAveragePnl(trades),
      totalPnl: this.calculateTotalPnl(trades),
    };
  }
}
