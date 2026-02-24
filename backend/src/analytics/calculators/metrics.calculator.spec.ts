import { MetricsCalculator, TradePnl } from './metrics.calculator';

describe('MetricsCalculator', () => {
  let calculator: MetricsCalculator;

  beforeEach(() => {
    calculator = new MetricsCalculator();
  });

  // ---------------------------------------------------------------------------
  // calculateWinRate
  // ---------------------------------------------------------------------------
  describe('calculateWinRate', () => {
    it('should return 0 for empty trades', () => {
      expect(calculator.calculateWinRate([])).toBe(0);
    });

    it('should calculate win rate correctly for mixed trades', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 },
        { pnlNet: -50 },
        { pnlNet: 200 },
        { pnlNet: -30 },
      ];
      expect(calculator.calculateWinRate(trades)).toBe(50);
    });

    it('should return 100 when all trades are winners', () => {
      const trades: TradePnl[] = [
        { pnlNet: 10 },
        { pnlNet: 20 },
        { pnlNet: 30 },
      ];
      expect(calculator.calculateWinRate(trades)).toBe(100);
    });

    it('should return 0 when all trades are losers', () => {
      const trades: TradePnl[] = [{ pnlNet: -10 }, { pnlNet: -20 }];
      expect(calculator.calculateWinRate(trades)).toBe(0);
    });

    it('should not count break-even trades (pnlNet = 0) as wins', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 },
        { pnlNet: 0 },
        { pnlNet: -50 },
      ];
      // 1 win out of 3 = 33.33%
      expect(calculator.calculateWinRate(trades)).toBeCloseTo(33.33, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateProfitFactor
  // ---------------------------------------------------------------------------
  describe('calculateProfitFactor', () => {
    it('should return 0 for empty trades', () => {
      expect(calculator.calculateProfitFactor([])).toBe(0);
    });

    it('should calculate profit factor correctly', () => {
      const trades: TradePnl[] = [{ pnlNet: 300 }, { pnlNet: -100 }];
      expect(calculator.calculateProfitFactor(trades)).toBe(3);
    });

    it('should return Infinity when there are no losses', () => {
      const trades: TradePnl[] = [{ pnlNet: 100 }, { pnlNet: 200 }];
      expect(calculator.calculateProfitFactor(trades)).toBe(Infinity);
    });

    it('should return 0 when there are only break-even trades', () => {
      const trades: TradePnl[] = [{ pnlNet: 0 }];
      expect(calculator.calculateProfitFactor(trades)).toBe(0);
    });

    it('should handle mixed positive and negative trades', () => {
      const trades: TradePnl[] = [
        { pnlNet: 200 },
        { pnlNet: -100 },
        { pnlNet: 150 },
        { pnlNet: -50 },
      ];
      // gross profit = 350, gross loss = 150  → 350 / 150 = 2.333
      expect(calculator.calculateProfitFactor(trades)).toBeCloseTo(2.333, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateMaxDrawdown
  // ---------------------------------------------------------------------------
  describe('calculateMaxDrawdown', () => {
    it('should return 0 for empty trades', () => {
      expect(calculator.calculateMaxDrawdown([])).toBe(0);
    });

    it('should return 0 when equity only goes up', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 },
        { pnlNet: 50 },
        { pnlNet: 200 },
      ];
      expect(calculator.calculateMaxDrawdown(trades)).toBe(0);
    });

    it('should calculate drawdown from a single peak', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 },
        { pnlNet: -50 },
        { pnlNet: -30 },
      ];
      // equity: 100, 50, 20 — peak = 100, drawdown = 80
      expect(calculator.calculateMaxDrawdown(trades)).toBe(80);
    });

    it('should track the worst drawdown across multiple peaks', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 }, // equity 100
        { pnlNet: -30 }, // equity 70  (dd 30)
        { pnlNet: 50 }, // equity 120 (new peak)
        { pnlNet: -80 }, // equity 40  (dd 80)
        { pnlNet: 20 }, // equity 60
      ];
      expect(calculator.calculateMaxDrawdown(trades)).toBe(80);
    });

    it('should handle all-loss scenario', () => {
      const trades: TradePnl[] = [
        { pnlNet: -10 },
        { pnlNet: -20 },
        { pnlNet: -30 },
      ];
      // equity never goes above 0, peak stays 0
      // equity: -10, -30, -60; drawdown = 60
      expect(calculator.calculateMaxDrawdown(trades)).toBe(60);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateSharpeRatio
  // ---------------------------------------------------------------------------
  describe('calculateSharpeRatio', () => {
    it('should return 0 for fewer than 2 trades', () => {
      expect(calculator.calculateSharpeRatio([])).toBe(0);
      expect(calculator.calculateSharpeRatio([{ pnlNet: 100 }])).toBe(0);
    });

    it('should return 0 when all returns are identical (zero std-dev)', () => {
      const trades: TradePnl[] = [
        { pnlNet: 50 },
        { pnlNet: 50 },
        { pnlNet: 50 },
      ];
      expect(calculator.calculateSharpeRatio(trades)).toBe(0);
    });

    it('should return a positive Sharpe for profitable varied trades', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 },
        { pnlNet: 80 },
        { pnlNet: 120 },
        { pnlNet: 90 },
        { pnlNet: 110 },
      ];
      const sharpe = calculator.calculateSharpeRatio(trades);
      expect(sharpe).toBeGreaterThan(0);
    });

    it('should return a negative Sharpe for losing trades', () => {
      const trades: TradePnl[] = [
        { pnlNet: -100 },
        { pnlNet: -80 },
        { pnlNet: -120 },
        { pnlNet: -90 },
      ];
      const sharpe = calculator.calculateSharpeRatio(trades);
      expect(sharpe).toBeLessThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateExpectancy
  // ---------------------------------------------------------------------------
  describe('calculateExpectancy', () => {
    it('should return 0 for empty trades', () => {
      expect(calculator.calculateExpectancy([])).toBe(0);
    });

    it('should calculate expectancy correctly', () => {
      const trades: TradePnl[] = [
        { pnlNet: 200 },
        { pnlNet: -100 },
        { pnlNet: 300 },
        { pnlNet: -50 },
      ];
      // winRate = 0.5, avgWin = 250, lossRate = 0.5, avgLoss = 75
      // expectancy = 0.5 * 250 - 0.5 * 75 = 125 - 37.5 = 87.5
      expect(calculator.calculateExpectancy(trades)).toBeCloseTo(87.5, 2);
    });

    it('should return positive expectancy when all trades win', () => {
      const trades: TradePnl[] = [{ pnlNet: 100 }, { pnlNet: 200 }];
      // expectancy = 1 * 150 - 0 * 0 = 150
      expect(calculator.calculateExpectancy(trades)).toBe(150);
    });

    it('should return negative expectancy when all trades lose', () => {
      const trades: TradePnl[] = [{ pnlNet: -100 }, { pnlNet: -200 }];
      // expectancy = 0 * 0 - 1 * 150 = -150
      expect(calculator.calculateExpectancy(trades)).toBe(-150);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateAveragePnl
  // ---------------------------------------------------------------------------
  describe('calculateAveragePnl', () => {
    it('should return 0 for empty trades', () => {
      expect(calculator.calculateAveragePnl([])).toBe(0);
    });

    it('should calculate average correctly', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 },
        { pnlNet: -50 },
        { pnlNet: 200 },
      ];
      expect(calculator.calculateAveragePnl(trades)).toBeCloseTo(83.33, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateTotalPnl
  // ---------------------------------------------------------------------------
  describe('calculateTotalPnl', () => {
    it('should return 0 for empty trades', () => {
      expect(calculator.calculateTotalPnl([])).toBe(0);
    });

    it('should sum all PnL values', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 },
        { pnlNet: -50 },
        { pnlNet: 200 },
        { pnlNet: -30 },
      ];
      expect(calculator.calculateTotalPnl(trades)).toBe(220);
    });
  });

  // ---------------------------------------------------------------------------
  // calculateSummary
  // ---------------------------------------------------------------------------
  describe('calculateSummary', () => {
    it('should return a full summary object', () => {
      const trades: TradePnl[] = [
        { pnlNet: 100 },
        { pnlNet: -50 },
        { pnlNet: 200 },
        { pnlNet: -30 },
      ];

      const summary = calculator.calculateSummary(trades);

      expect(summary).toEqual(
        expect.objectContaining({
          totalTrades: 4,
          winRate: 50,
          totalPnl: 220,
        }),
      );
      expect(summary.profitFactor).toBeGreaterThan(0);
      expect(summary.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(typeof summary.sharpeRatio).toBe('number');
      expect(typeof summary.expectancy).toBe('number');
      expect(typeof summary.averagePnl).toBe('number');
    });

    it('should handle empty trades gracefully', () => {
      const summary = calculator.calculateSummary([]);

      expect(summary).toEqual({
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        expectancy: 0,
        averagePnl: 0,
        totalPnl: 0,
      });
    });
  });
});
