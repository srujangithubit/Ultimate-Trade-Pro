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
 * Yahoo Finance market data provider (free, no API key required).
 * Used as a fallback provider when Polygon/Alpha Vantage are unavailable.
 * Uses the v8 chart API.
 */
@Injectable()
export class YahooFinanceProvider implements MarketDataProvider {
  readonly providerId = 'yahoo_finance';
  readonly providerName = 'Yahoo Finance';
  readonly priority = 10; // Low priority — fallback only

  private readonly logger = new Logger(YahooFinanceProvider.name);
  private readonly baseUrl = 'https://query1.finance.yahoo.com';
  private readonly rateLimiter = new RateLimiter(30, 30); // conservative

  constructor(private readonly httpService: HttpService) {}

  async getHistoricalData(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe,
  ): Promise<OHLCV[]> {
    await this.rateLimiter.waitForToken();

    const interval = this.mapTimeframe(timeframe);
    const period1 = Math.floor(from.getTime() / 1000);
    const period2 = Math.floor(to.getTime() / 1000);

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/v8/finance/chart/${symbol}`,
        {
          params: {
            period1,
            period2,
            interval,
            includePrePost: false,
          },
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        },
      );
      return response.data;
    });

    const result = data?.chart?.result?.[0];
    if (!result || !result.timestamp) {
      return [];
    }

    const timestamps = result.timestamp;
    const ohlcv = result.indicators?.quote?.[0];
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose;

    if (!ohlcv) return [];

    const candles: OHLCV[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (ohlcv.open[i] != null) {
        candles.push({
          timestamp: new Date(timestamps[i] * 1000),
          open: ohlcv.open[i],
          high: ohlcv.high[i],
          low: ohlcv.low[i],
          close: adjClose?.[i] || ohlcv.close[i],
          volume: ohlcv.volume[i] || 0,
        });
      }
    }

    return candles;
  }

  async getRealtimeQuote(symbol: string): Promise<Quote> {
    await this.rateLimiter.waitForToken();

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/v8/finance/chart/${symbol}`,
        {
          params: {
            interval: '1m',
            range: '1d',
          },
          headers: {
            'User-Agent': 'Mozilla/5.0',
          },
        },
      );
      return response.data;
    });

    const meta = data?.chart?.result?.[0]?.meta;
    return {
      symbol,
      price: meta?.regularMarketPrice || 0,
      timestamp: new Date(),
      volume: meta?.regularMarketVolume,
    };
  }

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    await this.rateLimiter.waitForToken();

    try {
      const data = await withRetry(async () => {
        const response = await this.httpService.axiosRef.get(
          `https://query2.finance.yahoo.com/v1/finance/search`,
          {
            params: {
              q: query,
              quotesCount: 10,
              newsCount: 0,
            },
            headers: {
              'User-Agent': 'Mozilla/5.0',
            },
          },
        );
        return response.data;
      });

      return (data.quotes || []).map((q: any) => ({
        symbol: q.symbol,
        name: q.shortname || q.longname || q.symbol,
        type: this.mapQuoteType(q.quoteType),
        exchange: q.exchange,
      }));
    } catch {
      return [];
    }
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
      '4h': '1h', // Yahoo doesn't support 4h natively
      '1d': '1d',
      '1w': '1wk',
      '1M': '1mo',
    };
    return map[tf] || '1d';
  }

  private mapQuoteType(type: string): SymbolInfo['type'] {
    const map: Record<string, SymbolInfo['type']> = {
      EQUITY: 'stock',
      ETF: 'etf',
      CRYPTOCURRENCY: 'crypto',
      CURRENCY: 'forex',
      OPTION: 'option',
      FUTURE: 'future',
    };
    return map[type] || 'stock';
  }
}
