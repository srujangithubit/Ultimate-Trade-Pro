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
 * Alpha Vantage market data provider.
 * Docs: https://www.alphavantage.co/documentation/
 */
@Injectable()
export class AlphaVantageProvider implements MarketDataProvider {
  readonly providerId = 'alpha_vantage';
  readonly providerName = 'Alpha Vantage';
  readonly priority = 2;

  private readonly logger = new Logger(AlphaVantageProvider.name);
  private readonly baseUrl = 'https://www.alphavantage.co/query';
  private readonly rateLimiter = new RateLimiter(5, 5); // 5 req/min free tier

  constructor(private readonly httpService: HttpService) {}

  async getHistoricalData(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe,
  ): Promise<OHLCV[]> {
    await this.rateLimiter.waitForToken();

    const fn = this.getTimeSeriesFunction(timeframe);
    const interval = this.getInterval(timeframe);

    const params: any = {
      function: fn,
      symbol,
      apikey: process.env.ALPHA_VANTAGE_API_KEY,
      outputsize: 'full',
      datatype: 'json',
    };

    if (interval) params.interval = interval;

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(this.baseUrl, {
        params,
      });
      return response.data;
    });

    // Alpha Vantage responses have dynamic keys
    const timeSeriesKey = Object.keys(data).find((k) =>
      k.toLowerCase().includes('time series'),
    );

    if (!timeSeriesKey || !data[timeSeriesKey]) {
      return [];
    }

    const timeSeries = data[timeSeriesKey];
    const candles: OHLCV[] = [];

    for (const [dateStr, values] of Object.entries<any>(timeSeries)) {
      const timestamp = new Date(dateStr);
      if (timestamp >= from && timestamp <= to) {
        candles.push({
          timestamp,
          open: parseFloat(values['1. open']),
          high: parseFloat(values['2. high']),
          low: parseFloat(values['3. low']),
          close: parseFloat(values['4. close']),
          volume: parseFloat(values['5. volume'] || '0'),
        });
      }
    }

    return candles.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  async getRealtimeQuote(symbol: string): Promise<Quote> {
    await this.rateLimiter.waitForToken();

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(this.baseUrl, {
        params: {
          function: 'GLOBAL_QUOTE',
          symbol,
          apikey: process.env.ALPHA_VANTAGE_API_KEY,
        },
      });
      return response.data;
    });

    const quote = data['Global Quote'];
    return {
      symbol,
      price: parseFloat(quote?.['05. price'] || '0'),
      volume: parseFloat(quote?.['06. volume'] || '0'),
      timestamp: new Date(quote?.['07. latest trading day'] || Date.now()),
    };
  }

  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    await this.rateLimiter.waitForToken();

    const data = await withRetry(async () => {
      const response = await this.httpService.axiosRef.get(this.baseUrl, {
        params: {
          function: 'SYMBOL_SEARCH',
          keywords: query,
          apikey: process.env.ALPHA_VANTAGE_API_KEY,
        },
      });
      return response.data;
    });

    return (data.bestMatches || []).map((match: any) => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: this.mapType(match['3. type']),
      exchange: match['4. region'],
      currency: match['8. currency'],
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

  private getTimeSeriesFunction(tf: Timeframe): string {
    if (['1m', '5m', '15m', '30m', '1h'].includes(tf)) {
      return 'TIME_SERIES_INTRADAY';
    }
    if (tf === '1d') return 'TIME_SERIES_DAILY_ADJUSTED';
    if (tf === '1w') return 'TIME_SERIES_WEEKLY_ADJUSTED';
    if (tf === '1M') return 'TIME_SERIES_MONTHLY_ADJUSTED';
    return 'TIME_SERIES_DAILY_ADJUSTED';
  }

  private getInterval(tf: Timeframe): string | null {
    const map: Record<string, string> = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '30m': '30min',
      '1h': '60min',
    };
    return map[tf] || null;
  }

  private mapType(type: string): SymbolInfo['type'] {
    const lower = (type || '').toLowerCase();
    if (lower.includes('equity') || lower.includes('stock')) return 'stock';
    if (lower.includes('etf')) return 'etf';
    if (lower.includes('crypto')) return 'crypto';
    if (lower.includes('forex') || lower.includes('fx')) return 'forex';
    return 'stock';
  }
}
