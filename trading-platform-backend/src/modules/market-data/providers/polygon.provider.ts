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
 * Polygon.io market data provider.
 * Docs: https://polygon.io/docs/stocks
 */
@Injectable()
export class PolygonProvider implements MarketDataProvider {
  readonly providerId = 'polygon';
  readonly providerName = 'Polygon.io';
  readonly priority = 1;

  private readonly logger = new Logger(PolygonProvider.name);
  private readonly baseUrl = 'https://api.polygon.io';
  private readonly rateLimiter = new RateLimiter(5, 5); // free tier: 5 req/min

  constructor(private readonly httpService: HttpService) {}

  async getHistoricalData(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe,
  ): Promise<OHLCV[]> {
    const { multiplier, span } = this.mapTimeframe(timeframe);
    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    await this.rateLimiter.waitForToken();

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/v2/aggs/ticker/${symbol}/range/${multiplier}/${span}/${fromStr}/${toStr}`,
        {
          params: {
            apiKey: process.env.POLYGON_API_KEY,
            adjusted: true,
            sort: 'asc',
            limit: 50000,
          },
        },
      );
      return response.data;
    });

    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map((candle: any) => ({
      timestamp: new Date(candle.t),
      open: candle.o,
      high: candle.h,
      low: candle.l,
      close: candle.c,
      volume: candle.v,
    }));
  }

  async getRealtimeQuote(symbol: string): Promise<Quote> {
    await this.rateLimiter.waitForToken();

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/v2/last/trade/${symbol}`,
        {
          params: { apiKey: process.env.POLYGON_API_KEY },
        },
      );
      return response.data;
    });

    return {
      symbol,
      price: data.results?.p || 0,
      timestamp: new Date(data.results?.t || Date.now()),
      volume: data.results?.s,
    };
  }

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    await this.rateLimiter.waitForToken();

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/v3/reference/tickers`,
        {
          params: {
            apiKey: process.env.POLYGON_API_KEY,
            search: query,
            active: true,
            limit: 20,
          },
        },
      );
      return response.data;
    });

    return (data.results || []).map((ticker: any) => ({
      symbol: ticker.ticker,
      name: ticker.name,
      type: this.mapAssetType(ticker.type),
      exchange: ticker.primary_exchange,
      currency: ticker.currency_name,
    }));
  }

  async supportsSymbol(symbol: string): Promise<boolean> {
    try {
      const results = await this.searchSymbols(symbol);
      return results.some((r) => r.symbol === symbol);
    } catch {
      return false;
    }
  }

  private mapTimeframe(tf: Timeframe): { multiplier: number; span: string } {
    const map: Record<Timeframe, { multiplier: number; span: string }> = {
      '1m': { multiplier: 1, span: 'minute' },
      '5m': { multiplier: 5, span: 'minute' },
      '15m': { multiplier: 15, span: 'minute' },
      '30m': { multiplier: 30, span: 'minute' },
      '1h': { multiplier: 1, span: 'hour' },
      '4h': { multiplier: 4, span: 'hour' },
      '1d': { multiplier: 1, span: 'day' },
      '1w': { multiplier: 1, span: 'week' },
      '1M': { multiplier: 1, span: 'month' },
    };
    return map[tf] || { multiplier: 1, span: 'day' };
  }

  private mapAssetType(type: string): SymbolInfo['type'] {
    const map: Record<string, SymbolInfo['type']> = {
      CS: 'stock',
      ETF: 'etf',
      CRYPTO: 'crypto',
      FX: 'forex',
      OS: 'option',
      FUT: 'future',
    };
    return map[type] || 'stock';
  }
}
