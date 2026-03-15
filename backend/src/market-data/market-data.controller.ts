import { Controller, Get, Query, Logger } from '@nestjs/common';
import { MarketDataService } from './market-data.service';

/**
 * Maps various timeframe representations → DB resolution string.
 * DB stores: "1", "5", "10", "15", "30", "60"
 * MT5 format: M1, M5, M10, M15, M30, H1
 * Frontend format: 1m, 5m, 15m, 1h
 */
const TIMEFRAME_TO_RESOLUTION: Record<string, string> = {
  // MT5 format
  M1: '1',
  M5: '5',
  M10: '10',
  M15: '15',
  M30: '30',
  H1: '60',
  H4: '240',
  D1: '1440',
  // Frontend format
  '1m': '1',
  '5m': '5',
  '10m': '10',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1d': '1440',
  // Already numeric pass-through
  '1': '1',
  '5': '5',
  '10': '10',
  '15': '15',
  '30': '30',
  '60': '60',
  '240': '240',
  '1440': '1440',
};

@Controller('market-data')
export class MarketDataController {
  private readonly logger = new Logger(MarketDataController.name);

  constructor(private readonly marketDataService: MarketDataService) {}

  /**
   * GET /market-data/candles?symbol=XAUUSD&timeframe=M5&bars=300
   * Returns the latest N candles for a symbol/timeframe from the DB.
   */
  @Get('candles')
  async getCandles(
    @Query('symbol') symbol: string,
    @Query('timeframe') timeframe: string,
    @Query('bars') barsStr?: string,
  ) {
    const bars = Math.min(parseInt(barsStr || '300', 10) || 300, 5000);
    const resolution = TIMEFRAME_TO_RESOLUTION[timeframe] || timeframe;

    this.logger.debug(
      `getCandles: symbol=${symbol} timeframe=${timeframe} -> resolution=${resolution} bars=${bars}`,
    );

    const candles = await this.marketDataService.getLatestCandles(
      symbol,
      resolution,
      bars,
    );

    return {
      type: 'ohlcv',
      symbol: symbol?.toUpperCase(),
      timeframe,
      data: candles.map((c) => ({
        time: new Date(c.time * 1000).toISOString(),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        tick_volume: c.volume,
      })),
    };
  }

  /**
   * GET /market-data/symbols - list available symbol/resolution combos
   */
  @Get('symbols')
  async getSymbols() {
    return this.marketDataService.getAvailableSymbols();
  }
}
