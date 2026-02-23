import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import {
  MarketDataProvider,
  OHLCV,
  Quote,
  Timeframe,
  SymbolInfo,
} from './market-data.interface';
import { RateLimiter } from '../../../common/utils/rate-limiter.util';
import { withRetry } from '../../../common/utils/retry.util';

/**
 * Binance market data provider for cryptocurrency OHLCV data.
 * Docs: https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
 */
@Injectable()
export class BinanceMarketProvider implements MarketDataProvider {
  readonly providerId = 'binance_market';
  readonly providerName = 'Binance Market Data';
  readonly priority = 3;

  private readonly logger = new Logger(BinanceMarketProvider.name);
  private readonly baseUrl = 'https://api.binance.com';
  private readonly rateLimiter = new RateLimiter(1200, 20); // 1200 req/min

  constructor(private readonly httpService: HttpService) {}

  async getHistoricalData(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe,
  ): Promise<OHLCV[]> {
    await this.rateLimiter.waitForToken();

    const interval = this.mapTimeframe(timeframe);

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/api/v3/klines`,
        {
          params: {
            symbol: symbol.replace('-', '').replace('/', ''),
            interval,
            startTime: from.getTime(),
            endTime: to.getTime(),
            limit: 1000,
          },
        },
      );
      return response.data;
    });

    return (data || []).map((kline: any[]) => ({
      timestamp: new Date(kline[0]),
      open: parseFloat(kline[1]),
      high: parseFloat(kline[2]),
      low: parseFloat(kline[3]),
      close: parseFloat(kline[4]),
      volume: parseFloat(kline[5]),
    }));
  }

  async getRealtimeQuote(symbol: string): Promise<Quote> {
    await this.rateLimiter.waitForToken();

    const cleanSymbol = symbol.replace('-', '').replace('/', '');

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/api/v3/ticker/price`,
        { params: { symbol: cleanSymbol } },
      );
      return response.data;
    });

    return {
      symbol,
      price: parseFloat(data.price),
      timestamp: new Date(),
    };
  }

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    await this.rateLimiter.waitForToken();

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/api/v3/exchangeInfo`,
      );
      return response.data;
    });

    const queryUpper = query.toUpperCase();
    return (data.symbols || [])
      .filter(
        (s: any) =>
          s.symbol.includes(queryUpper) || s.baseAsset.includes(queryUpper),
      )
      .slice(0, 20)
      .map((s: any) => ({
        symbol: s.symbol,
        name: `${s.baseAsset}/${s.quoteAsset}`,
        type: 'crypto' as const,
        exchange: 'Binance',
        currency: s.quoteAsset,
      }));
  }

  async supportsSymbol(symbol: string): Promise<boolean> {
    try {
      const quote = await this.getRealtimeQuote(symbol);
      return quote.price > 0;
    } catch {
      return false;
    }
  }

  private mapTimeframe(tf: Timeframe): string {
    const map: Record<Timeframe, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1w',
      '1M': '1M',
    };
    return map[tf] || '1d';
  }
}
