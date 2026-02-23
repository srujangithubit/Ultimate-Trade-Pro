import { Injectable, Logger } from '@nestjs/common';
import { OHLCV, Quote, Timeframe } from '../providers/market-data.interface';

/**
 * In-memory cache for market data with TTL support.
 * In production, replace backing store with Redis using ioredis.
 */
@Injectable()
export class MarketDataCacheService {
  private readonly logger = new Logger(MarketDataCacheService.name);
  private readonly cache = new Map<string, { data: any; expiresAt: number }>();

  /** TTL for realtime quotes (seconds) */
  private readonly quoteTtl = 5;
  /** TTL for historical data (seconds) */
  private readonly historicalTtl = 3600;
  /** TTL for symbol search results (seconds) */
  private readonly searchTtl = 300;

  /**
   * Get cached realtime quote.
   */
  getQuote(symbol: string): Quote | null {
    return this.get<Quote>(`quote:${symbol}`);
  }

  /**
   * Cache a realtime quote.
   */
  setQuote(symbol: string, quote: Quote): void {
    this.set(`quote:${symbol}`, quote, this.quoteTtl);
  }

  /**
   * Get cached historical data.
   */
  getHistorical(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe,
  ): OHLCV[] | null {
    const key = this.historicalKey(symbol, from, to, timeframe);
    return this.get<OHLCV[]>(key);
  }

  /**
   * Cache historical data.
   */
  setHistorical(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe,
    data: OHLCV[],
  ): void {
    const key = this.historicalKey(symbol, from, to, timeframe);
    this.set(key, data, this.historicalTtl);
  }

  /**
   * Get cached search results.
   */
  getSearchResults(query: string): any[] | null {
    return this.get<any[]>(`search:${query.toLowerCase()}`);
  }

  /**
   * Cache search results.
   */
  setSearchResults(query: string, results: any[]): void {
    this.set(`search:${query.toLowerCase()}`, results, this.searchTtl);
  }

  /**
   * Clear all cached data.
   */
  clear(): void {
    this.cache.clear();
    this.logger.log('Cache cleared');
  }

  /**
   * Clear expired entries (call periodically).
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.debug(`Cleaned up ${removed} expired cache entries`);
    }
  }

  private get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private set(key: string, data: any, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  private historicalKey(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe,
  ): string {
    return `hist:${symbol}:${timeframe}:${from.toISOString().split('T')[0]}:${to.toISOString().split('T')[0]}`;
  }
}
