import { Injectable, Logger } from '@nestjs/common';
import {
  MarketDataService,
  LightweightCandle,
} from '../../market-data/market-data.service';
import { CandleFrame } from '../types/replay.types';

@Injectable()
export class CandleLoaderService {
  private readonly logger = new Logger(CandleLoaderService.name);
  private readonly cache: Map<string, CandleFrame[]> = new Map();

  constructor(private readonly marketDataService: MarketDataService) {}

  async loadForSession(
    sessionId: string,
    symbol: string,
    resolution: string,
    from: Date,
    to: Date,
  ): Promise<CandleFrame[]> {
    // If cache has sessionId, return cached (allows reconnects without re-querying)
    const cached = this.cache.get(sessionId);
    if (cached) {
      this.logger.debug(
        `loadForSession: returning ${cached.length} cached candles for session ${sessionId}`,
      );
      return cached;
    }

    this.logger.log(
      `loadForSession: querying DB for session=${sessionId} symbol=${symbol} resolution=${resolution} ` +
        `from=${from.toISOString()} to=${to.toISOString()}`,
    );

    const lightweightCandles: LightweightCandle[] =
      await this.marketDataService.getCandles(symbol, resolution, from, to);

    if (lightweightCandles.length === 0) {
      throw new Error(
        `No candle data found for session ${sessionId}: ` +
          `symbol=${symbol} resolution=${resolution} from=${from.toISOString()} to=${to.toISOString()}. ` +
          `Run the import script first: npx ts-node scripts/import-candles.ts`,
      );
    }

    // Map LightweightCandle[] to CandleFrame[] adding index field
    const frames: CandleFrame[] = lightweightCandles.map((c, index) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      index,
    }));

    // Store in cache
    this.cache.set(sessionId, frames);

    const memEstimate = ((frames.length * 48) / 1024 / 1024).toFixed(2);
    this.logger.log(
      `loadForSession: cached ${frames.length} candles for session ${sessionId} (~${memEstimate}MB)`,
    );

    return frames;
  }

  getFromCache(sessionId: string): CandleFrame[] | null {
    return this.cache.get(sessionId) ?? null;
  }

  evictSession(sessionId: string): void {
    if (this.cache.has(sessionId)) {
      const count = this.cache.get(sessionId)?.length ?? 0;
      this.cache.delete(sessionId);
      this.logger.log(
        `evictSession: evicted ${count} candles for session ${sessionId}`,
      );
    }
  }

  getLoadedSymbol(
    sessionId: string,
  ): { symbol: string; resolution: string; count: number } | null {
    const frames = this.cache.get(sessionId);
    if (!frames || frames.length === 0) return null;
    // Symbol/resolution aren't stored on frames — caller should track metadata
    return { symbol: '', resolution: '', count: frames.length };
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheStats(): {
    sessionId: string;
    candleCount: number;
    memEstimateMB: string;
  }[] {
    const stats: {
      sessionId: string;
      candleCount: number;
      memEstimateMB: string;
    }[] = [];
    for (const [sessionId, frames] of this.cache) {
      stats.push({
        sessionId,
        candleCount: frames.length,
        memEstimateMB: ((frames.length * 48) / 1024 / 1024).toFixed(2),
      });
    }
    return stats;
  }
}
