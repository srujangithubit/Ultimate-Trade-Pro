import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LightweightCandle {
  time: number;   // unix seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SymbolInfo {
  symbol: string;
  resolution: string;
  count: number;
  earliest: Date;
  latest: Date;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private readonly CURSOR_PAGE_SIZE = 50_000;
  private readonly CURSOR_THRESHOLD = 50_000;

  constructor(private readonly prisma: PrismaService) {}

  async getCandles(
    symbol: string,
    resolution: string,
    from: Date,
    to: Date,
  ): Promise<LightweightCandle[]> {
    const symbolUpper = symbol.toUpperCase().trim();
    const resolutionNorm = resolution.trim();

    this.logger.debug(
      `getCandles: ${symbolUpper} ${resolutionNorm} ${from.toISOString()} → ${to.toISOString()}`
    );

    const count = await this.getCandleCount(symbolUpper, resolutionNorm, from, to);
    this.logger.debug(`getCandles: expected ${count} rows`);

    if (count === 0) {
      this.logger.warn(
        `getCandles: zero rows found for ${symbolUpper} ${resolutionNorm}. ` +
        `Verify symbol/resolution values exist in MarketDataCandle table.`
      );
      return [];
    }

    if (count <= this.CURSOR_THRESHOLD) {
      // Small dataset: single query
      const rows = await this.prisma.marketDataCandle.findMany({
        where: {
          symbol: symbolUpper,
          resolution: resolutionNorm,
          time: { gte: from, lte: to },
        },
        orderBy: { time: 'asc' },
        select: { time: true, open: true, high: true, low: true, close: true, volume: true },
      });
      return rows.map(this.mapToLightweightCandle);
    }

    // Large dataset: cursor pagination to avoid single massive query
    return this.getCandlesPaginated(symbolUpper, resolutionNorm, from, to, count);
  }

  private async getCandlesPaginated(
    symbol: string,
    resolution: string,
    from: Date,
    to: Date,
    expectedCount: number,
  ): Promise<LightweightCandle[]> {
    const results: LightweightCandle[] = [];
    let cursor: string | undefined = undefined;
    let pagesLoaded = 0;

    this.logger.debug(`getCandlesPaginated: loading ${expectedCount} rows in pages of ${this.CURSOR_PAGE_SIZE}`);

    while (true) {
      const page = await this.prisma.marketDataCandle.findMany({
        where: {
          symbol,
          resolution,
          time: { gte: from, lte: to },
        },
        orderBy: { time: 'asc' },
        take: this.CURSOR_PAGE_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        select: { id: true, time: true, open: true, high: true, low: true, close: true, volume: true },
      });

      if (page.length === 0) break;

      for (const row of page) {
        results.push(this.mapToLightweightCandle(row));
      }

      pagesLoaded++;
      this.logger.debug(
        `getCandlesPaginated: page ${pagesLoaded} loaded (${results.length}/${expectedCount} rows)`
      );

      if (page.length < this.CURSOR_PAGE_SIZE) break;
      cursor = page[page.length - 1].id;
    }

    return results;
  }

  private mapToLightweightCandle(row: {
    time: Date;
    open: unknown;
    high: unknown;
    low: unknown;
    close: unknown;
    volume: unknown;
  }): LightweightCandle {
    return {
      time: Math.floor(new Date(row.time).getTime() / 1000),
      open: parseFloat(row.open!.toString()),
      high: parseFloat(row.high!.toString()),
      low: parseFloat(row.low!.toString()),
      close: parseFloat(row.close!.toString()),
      volume: parseFloat(row.volume!.toString()),
    };
  }

  async getCandleCount(
    symbol: string,
    resolution: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    return this.prisma.marketDataCandle.count({
      where: {
        symbol: symbol.toUpperCase().trim(),
        resolution: resolution.trim(),
        time: { gte: from, lte: to },
      },
    });
  }

  async getAvailableSymbols(): Promise<SymbolInfo[]> {
    const rows = await this.prisma.$queryRaw<{
      symbol: string;
      resolution: string;
      count: bigint;
      earliest: Date;
      latest: Date;
    }[]>`
      SELECT
        symbol,
        resolution,
        COUNT(*) as count,
        MIN(time) as earliest,
        MAX(time) as latest
      FROM "MarketDataCandle"
      GROUP BY symbol, resolution
      ORDER BY symbol, resolution ASC
    `;
    return rows.map(r => ({
      symbol: r.symbol,
      resolution: r.resolution,
      count: Number(r.count),
      earliest: r.earliest,
      latest: r.latest,
    }));
  }

  async getResolutionsForSymbol(symbol: string): Promise<string[]> {
    const rows = await this.prisma.marketDataCandle.findMany({
      where: { symbol: symbol.toUpperCase().trim() },
      distinct: ['resolution'],
      select: { resolution: true },
      orderBy: { resolution: 'asc' },
    });
    return rows.map(r => r.resolution);
  }

  /**
   * Get the latest N candles for a symbol/resolution (no date range needed).
   * Returns candles sorted ascending by time.
   */
  async getLatestCandles(
    symbol: string,
    resolution: string,
    limit: number,
  ): Promise<LightweightCandle[]> {
    const symbolUpper = symbol.toUpperCase().trim();
    const resolutionNorm = resolution.trim();

    this.logger.debug(
      `getLatestCandles: ${symbolUpper} ${resolutionNorm} limit=${limit}`,
    );

    // Query latest N rows descending, then reverse for ascending order
    const rows = await this.prisma.marketDataCandle.findMany({
      where: {
        symbol: symbolUpper,
        resolution: resolutionNorm,
      },
      orderBy: { time: 'desc' },
      take: limit,
      select: { time: true, open: true, high: true, low: true, close: true, volume: true },
    });

    if (rows.length === 0) {
      this.logger.warn(
        `getLatestCandles: zero rows for ${symbolUpper} ${resolutionNorm}`,
      );
      return [];
    }

    this.logger.debug(`getLatestCandles: returning ${rows.length} candles`);
    return rows.reverse().map(this.mapToLightweightCandle);
  }
}
