import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Available timeframes */
type Timeframe = '1m' | '5m' | '15m' | '1h';

const TIMEFRAME_MS: Record<Timeframe, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
};

export interface SymbolConfig {
  symbol: string;
  displayName: string;
  pipSize: number;
  pipValue: number;
  minVolume: number;
  maxVolume: number;
  volumeStep: number;
  contractSize: number;
  currency: string;
}

export const TRADING_SYMBOLS: SymbolConfig[] = [
  {
    symbol: 'EURUSD',
    displayName: 'EUR/USD',
    pipSize: 0.0001,
    pipValue: 10,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
    contractSize: 100000,
    currency: 'USD',
  },
  {
    symbol: 'GBPUSD',
    displayName: 'GBP/USD',
    pipSize: 0.0001,
    pipValue: 10,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
    contractSize: 100000,
    currency: 'USD',
  },
  {
    symbol: 'USDJPY',
    displayName: 'USD/JPY',
    pipSize: 0.01,
    pipValue: 6.7,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
    contractSize: 100000,
    currency: 'USD',
  },
  {
    symbol: 'XAUUSD',
    displayName: 'Gold',
    pipSize: 0.01,
    pipValue: 1,
    minVolume: 0.01,
    maxVolume: 50,
    volumeStep: 0.01,
    contractSize: 100,
    currency: 'USD',
  },
  {
    symbol: 'BTCUSD',
    displayName: 'BTC/USD',
    pipSize: 0.01,
    pipValue: 0.01,
    minVolume: 0.001,
    maxVolume: 10,
    volumeStep: 0.001,
    contractSize: 1,
    currency: 'USD',
  },
  {
    symbol: 'US500',
    displayName: 'S&P 500',
    pipSize: 0.1,
    pipValue: 1,
    minVolume: 0.1,
    maxVolume: 100,
    volumeStep: 0.1,
    contractSize: 10,
    currency: 'USD',
  },
  {
    symbol: 'NAS100',
    displayName: 'Nasdaq 100',
    pipSize: 0.1,
    pipValue: 1,
    minVolume: 0.1,
    maxVolume: 100,
    volumeStep: 0.1,
    contractSize: 10,
    currency: 'USD',
  },
  {
    symbol: 'EURGBP',
    displayName: 'EUR/GBP',
    pipSize: 0.0001,
    pipValue: 13,
    minVolume: 0.01,
    maxVolume: 100,
    volumeStep: 0.01,
    contractSize: 100000,
    currency: 'GBP',
  },
];

export interface CandlePayload {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class ChartsService {
  private readonly logger = new Logger(ChartsService.name);

  constructor(private readonly prisma: PrismaService) {}

  getSymbols(): SymbolConfig[] {
    return TRADING_SYMBOLS;
  }

  /**
   * Generate demo candle data for a symbol/timeframe.
   * In production this would come from the database or MT5 bridge.
   */
  generateDemoCandles(
    symbol: string,
    timeframe: string,
    from: Date,
    to: Date,
  ): CandlePayload[] {
    const tf = timeframe as Timeframe;
    const intervalMs = TIMEFRAME_MS[tf] || 300_000;
    const candles: CandlePayload[] = [];

    // Use a symbol-specific seed for different price ranges
    let basePrice: number;
    switch (symbol) {
      case 'EURUSD':
        basePrice = 1.085;
        break;
      case 'GBPUSD':
        basePrice = 1.265;
        break;
      case 'USDJPY':
        basePrice = 149.5;
        break;
      case 'XAUUSD':
        basePrice = 2035.5;
        break;
      case 'BTCUSD':
        basePrice = 51250.0;
        break;
      case 'US500':
        basePrice = 5100.0;
        break;
      case 'NAS100':
        basePrice = 18200.0;
        break;
      case 'EURGBP':
        basePrice = 0.856;
        break;
      default:
        basePrice = 1.0;
    }

    const config = TRADING_SYMBOLS.find((s) => s.symbol === symbol);
    const pipSize = config?.pipSize || 0.0001;
    const volatility = pipSize * 50; // 50 pips of volatility per candle

    let currentPrice = basePrice;
    let startTime = from.getTime();
    const endTime = to.getTime();

    // Simple deterministic random based on timestamp
    const seededRandom = (seed: number): number => {
      const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    let seed = symbol.length * 1000 + (from.getTime() % 100000);

    while (startTime < endTime && candles.length < 500) {
      seed++;
      const r1 = seededRandom(seed);
      const r2 = seededRandom(seed + 1);
      const r3 = seededRandom(seed + 2);
      const r4 = seededRandom(seed + 3);

      // Trend component
      const trend = (r1 - 0.48) * volatility * 2;
      const open = currentPrice;
      const close = open + trend;
      const highExtra = Math.abs(r2 * volatility);
      const lowExtra = Math.abs(r3 * volatility);
      const high = Math.max(open, close) + highExtra;
      const low = Math.min(open, close) - lowExtra;
      const volume = Math.floor(100 + r4 * 900);

      candles.push({
        time: Math.floor(startTime / 1000),
        open: parseFloat(open.toFixed(5)),
        high: parseFloat(high.toFixed(5)),
        low: parseFloat(low.toFixed(5)),
        close: parseFloat(close.toFixed(5)),
        volume,
      });

      currentPrice = close;
      startTime += intervalMs;
    }

    return candles;
  }

  /**
   * Get performance stats (demo data).
   */
  getPerformanceStats() {
    return {
      stats: {
        netPnl: 12450.75,
        winRate: 62.3,
        maxDrawdown: 3200.5,
        sharpeRatio: 1.85,
        profitFactor: 2.15,
        expectancy: 45.8,
        totalTrades: 272,
        winningTrades: 169,
        losingTrades: 103,
        avgWin: 185.5,
        avgLoss: -112.3,
      },
      equityCurve: this.generateEquityCurve(),
    };
  }

  private generateEquityCurve(): Array<{
    date: string;
    equity: number;
    drawdown: number;
    benchmark: number;
  }> {
    const curve: Array<{
      date: string;
      equity: number;
      drawdown: number;
      benchmark: number;
    }> = [];
    let equity = 100000;
    let peak = equity;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dailyPnl = (Math.random() - 0.42) * 1000; // Slight upward bias
      equity += dailyPnl;
      if (equity > peak) peak = equity;
      const drawdown = peak - equity;

      curve.push({
        date: date.toISOString().split('T')[0],
        equity: parseFloat(equity.toFixed(2)),
        drawdown: parseFloat(drawdown.toFixed(2)),
        benchmark: parseFloat((100000 + i * 100).toFixed(2)),
      });
    }

    return curve;
  }
}
