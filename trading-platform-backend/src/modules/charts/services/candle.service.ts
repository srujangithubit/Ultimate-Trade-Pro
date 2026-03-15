import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TickEntity } from '../entities/tick.entity';
import { CandleEntity } from '../entities/candle.entity';
import { TickDto } from '../dto';
import { Timeframe, TIMEFRAME_MS } from '../constants';

interface AggregatingCandle {
    symbol: string;
    timeframe: Timeframe;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    time: Date;
    periodStart: number;
}

@Injectable()
export class CandleService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(CandleService.name);

    /** Map<`${symbol}:${timeframe}`, AggregatingCandle> */
    private readonly activeCandles = new Map<string, AggregatingCandle>();

    /** Buffer of ticks awaiting bulk insert */
    private tickBuffer: Partial<TickEntity>[] = [];
    private flushInterval: ReturnType<typeof setInterval> | null = null;

    /** Listeners for candle updates (gateway subscribes to these) */
    private candleListeners: Array<(event: { symbol: string; timeframe: string; candle: CandlePayload; closed: boolean }) => void> = [];

    constructor(
        @InjectRepository(TickEntity)
        private readonly tickRepo: Repository<TickEntity>,
        @InjectRepository(CandleEntity)
        private readonly candleRepo: Repository<CandleEntity>,
    ) { }

    onModuleInit(): void {
        // Flush tick buffer every 500ms to avoid write storms
        this.flushInterval = setInterval(() => {
            this.flushTickBuffer().catch((err) => this.logger.error('Tick flush error', err));
        }, 500);
        this.logger.log('CandleService initialized with 500ms tick flush interval');
    }

    onModuleDestroy(): void {
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }
        // Final flush
        this.flushTickBuffer().catch((err) => this.logger.error('Final tick flush error', err));
    }

    /**
     * Register a listener for candle updates.
     * Returns an unsubscribe function.
     */
    onCandleUpdate(listener: (event: { symbol: string; timeframe: string; candle: CandlePayload; closed: boolean }) => void): () => void {
        this.candleListeners.push(listener);
        return () => {
            this.candleListeners = this.candleListeners.filter((l) => l !== listener);
        };
    }

    /**
     * Process an incoming tick: buffer for DB, aggregate into candles for each timeframe.
     */
    async processTick(tick: TickDto): Promise<void> {
        // Buffer tick for bulk insert
        this.tickBuffer.push({
            symbol: tick.symbol,
            bid: String(tick.bid),
            ask: String(tick.ask),
            last: String(tick.last),
            volume: String(tick.volume),
            timestamp: new Date(tick.timestamp),
        });

        // Aggregate into candles for each timeframe
        const timeframes: Timeframe[] = ['1m', '5m', '15m', '1h'];
        for (const tf of timeframes) {
            this.aggregateTick(tick, tf);
        }
    }

    /**
     * Get historical candles from the database.
     */
    async getHistoricalCandles(
        symbol: string,
        timeframe: string,
        from: Date,
        to: Date,
    ): Promise<CandlePayload[]> {
        const entities = await this.candleRepo.find({
            where: {
                symbol,
                timeframe,
                time: Between(from, to),
            },
            order: { time: 'ASC' },
        });

        return entities.map((e) => ({
            time: Math.floor(e.time.getTime() / 1000),
            open: parseFloat(e.open),
            high: parseFloat(e.high),
            low: parseFloat(e.low),
            close: parseFloat(e.close),
            volume: parseFloat(e.volume),
        }));
    }

    /**
     * Get historical ticks from the database for replay.
     */
    async getHistoricalTicks(
        symbol: string,
        from: Date,
        to: Date,
    ): Promise<TickPayload[]> {
        const entities = await this.tickRepo.find({
            where: {
                symbol,
                timestamp: Between(from, to),
            },
            order: { timestamp: 'ASC' },
        });

        return entities.map((e) => ({
            symbol: e.symbol,
            bid: e.bid,
            ask: e.ask,
            last: e.last,
            volume: e.volume,
            timestamp: e.timestamp.getTime(),
        }));
    }

    // ── Private Methods ─────────────────────────────────────────────────────

    private aggregateTick(tick: TickDto, timeframe: Timeframe): void {
        const intervalMs = TIMEFRAME_MS[timeframe];
        const periodStart = Math.floor(tick.timestamp / intervalMs) * intervalMs;
        const key = `${tick.symbol}:${timeframe}`;

        const existing = this.activeCandles.get(key);

        if (existing && existing.periodStart === periodStart) {
            // Update existing candle
            existing.high = Math.max(existing.high, tick.last);
            existing.low = Math.min(existing.low, tick.last);
            existing.close = tick.last;
            existing.volume += tick.volume;

            this.emitCandleUpdate(tick.symbol, timeframe, existing, false);
        } else {
            // Close previous candle if exists
            if (existing) {
                this.emitCandleUpdate(tick.symbol, timeframe, existing, true);
                this.persistCandle(existing).catch((err) =>
                    this.logger.error('Candle persist error', err),
                );
            }

            // Start new candle
            const newCandle: AggregatingCandle = {
                symbol: tick.symbol,
                timeframe,
                open: tick.last,
                high: tick.last,
                low: tick.last,
                close: tick.last,
                volume: tick.volume,
                time: new Date(periodStart),
                periodStart,
            };
            this.activeCandles.set(key, newCandle);
            this.emitCandleUpdate(tick.symbol, timeframe, newCandle, false);
        }
    }

    private emitCandleUpdate(
        symbol: string,
        timeframe: string,
        candle: AggregatingCandle,
        closed: boolean,
    ): void {
        const payload: CandlePayload = {
            time: Math.floor(candle.time.getTime() / 1000),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
        };

        for (const listener of this.candleListeners) {
            try {
                listener({ symbol, timeframe, candle: payload, closed });
            } catch (err) {
                this.logger.error('Candle listener error', err);
            }
        }
    }

    private async persistCandle(candle: AggregatingCandle): Promise<void> {
        await this.candleRepo.upsert(
            {
                symbol: candle.symbol,
                timeframe: candle.timeframe,
                open: String(candle.open),
                high: String(candle.high),
                low: String(candle.low),
                close: String(candle.close),
                volume: String(candle.volume),
                time: candle.time,
            },
            ['symbol', 'timeframe', 'time'],
        );
    }

    private async flushTickBuffer(): Promise<void> {
        if (this.tickBuffer.length === 0) return;

        const batch = this.tickBuffer.splice(0, this.tickBuffer.length);
        try {
            await this.tickRepo
                .createQueryBuilder()
                .insert()
                .into(TickEntity)
                .values(batch)
                .execute();
        } catch (err) {
            this.logger.error(`Failed to flush ${batch.length} ticks`, err);
        }
    }
}

// ── Response Types ──────────────────────────────────────────────────────────

export interface CandlePayload {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface TickPayload {
    symbol: string;
    bid: string;
    ask: string;
    last: string;
    volume: string;
    timestamp: number;
}
