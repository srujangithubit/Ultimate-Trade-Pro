import { Injectable, Logger } from '@nestjs/common';
import {
  MarketDataProvider,
  OHLCV,
  Quote,
  Timeframe,
  SymbolInfo,
} from '../providers/market-data.interface';
import { MarketDataCacheService } from './market-data-cache.service';
import { PolygonProvider } from '../providers/polygon.provider';
import { AlphaVantageProvider } from '../providers/alpha-vantage.provider';
import { YahooFinanceProvider } from '../providers/yahoo-finance.provider';
import { BinanceMarketProvider } from '../providers/binance-market.provider';

/**
 * Market data orchestrator with provider fallback chain and cache-first strategy.
 *
 * Fallback order (by priority):
 *  1. Polygon.io (priority 1)
 *  2. Alpha Vantage (priority 2)
 *  3. Binance (priority 3, crypto only)
 *  4. Yahoo Finance (priority 10, free fallback)
 */
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly providers: MarketDataProvider[];

  constructor(
    private readonly cache: MarketDataCacheService,
    private readonly polygon: PolygonProvider,
    private readonly alphaVantage: AlphaVantageProvider,
    private readonly yahooFinance: YahooFinanceProvider,
    private readonly binanceMarket: BinanceMarketProvider,
  ) {
    this.providers = [polygon, alphaVantage, binanceMarket, yahooFinance].sort(
      (a, b) => a.priority - b.priority,
    );
  }

  /**
   * Fetch historical OHLCV data with cache and provider fallback.
   */
  async getHistoricalData(
    symbol: string,
    from: Date,
    to: Date,
    timeframe: Timeframe = '1d',
  ): Promise<OHLCV[]> {
    // Check cache first
    const cached = this.cache.getHistorical(symbol, from, to, timeframe);
    if (cached) {
      this.logger.debug(`Cache hit for historical ${symbol}`);
      return cached;
    }

    // Try each provider in priority order
    for (const provider of this.providers) {
      try {
        this.logger.debug(
          `Trying ${provider.providerName} for ${symbol} historical`,
        );
        const data = await provider.getHistoricalData(
          symbol,
          from,
          to,
          timeframe,
        );
        if (data && data.length > 0) {
          this.cache.setHistorical(symbol, from, to, timeframe, data);
          return data;
        }
      } catch (error: any) {
        this.logger.warn(
          `${provider.providerName} failed for ${symbol}: ${error.message}`,
        );
      }
    }

    this.logger.error(`All providers failed for ${symbol} historical data`);
    return [];
  }

  /**
   * Get a realtime/near-realtime quote with cache and provider fallback.
   */
  async getRealtimeQuote(symbol: string): Promise<Quote> {
    const cached = this.cache.getQuote(symbol);
    if (cached) {
      return cached;
    }

    for (const provider of this.providers) {
      try {
        const quote = await provider.getRealtimeQuote(symbol);
        if (quote && quote.price > 0) {
          this.cache.setQuote(symbol, quote);
          return quote;
        }
      } catch (error: any) {
        this.logger.warn(
          `${provider.providerName} failed for ${symbol} quote: ${error.message}`,
        );
      }
    }

    return {
      symbol,
      price: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Search symbols across all providers.
   */
  async searchSymbols(query: string): Promise<SymbolInfo[]> {
    const cached = this.cache.getSearchResults(query);
    if (cached) return cached;

    const allResults: SymbolInfo[] = [];
    const seenSymbols = new Set<string>();

    for (const provider of this.providers) {
      try {
        const results = await provider.searchSymbols(query);
        for (const result of results) {
          if (!seenSymbols.has(result.symbol)) {
            seenSymbols.add(result.symbol);
            allResults.push(result);
          }
        }
      } catch (error: any) {
        this.logger.warn(
          `${provider.providerName} search failed: ${error.message}`,
        );
      }
    }

    this.cache.setSearchResults(query, allResults);
    return allResults;
  }

  /**
   * Get multiple quotes in a batch.
   */
  async getBatchQuotes(symbols: string[]): Promise<Map<string, Quote>> {
    const results = new Map<string, Quote>();
    const promises = symbols.map(async (symbol) => {
      const quote = await this.getRealtimeQuote(symbol);
      results.set(symbol, quote);
    });

    await Promise.allSettled(promises);
    return results;
  }

  /**
   * Get the list of available providers and their status.
   */
  getProviderStatus(): Array<{ id: string; name: string; priority: number }> {
    return this.providers.map((p) => ({
      id: p.providerId,
      name: p.providerName,
      priority: p.priority,
    }));
  }

  /**
   * Get price at a specific historical timestamp.
   * Uses getHistoricalData to fetch the candle for that time.
   */
  async getPriceAtTime(symbol: string, timestamp: Date): Promise<OHLCV | null> {
    // Define a window around the timestamp to ensure we capture the candle
    // For '1d', the timestamp usually represents 00:00:00.
    // We'll request the specific day.
    const from = new Date(timestamp);
    // Ensure from is start of day if we use 1d coverage, but getHistoricalData logic depends on provider.
    // Let's pass the timestamp directly as start and end for now, or a small range.

    // Actually best to ask for a small range.
    const to = new Date(timestamp);

    // If we want the candle *containing* this timestamp.
    const data = await this.getHistoricalData(symbol, from, to, '1d');

    if (data && data.length > 0) {
      // Return the first candle found
      return data[0];
    }

    return null;
  }
}
