import { Injectable, Logger } from '@nestjs/common';
import { CandleService, CandlePayload } from './candle.service';

// ─── Indicator State Types ──────────────────────────────────────────────────

interface RSIState {
    period: number;
    prevClose: number | null;
    avgGain: number;
    avgLoss: number;
    count: number;
}

interface ATRState {
    period: number;
    prevCandle: CandlePayload | null;
    atrSum: number;
    count: number;
    currentATR: number;
}

interface VWAPState {
    cumulativeTPV: number;
    cumulativeVolume: number;
    sessionDate: string | null;
}

interface SymbolTimeframeState {
    ema9: number | null;
    ema21: number | null;
    ema50: number | null;
    rsiState: RSIState;
    atrState: ATRState;
    vwapState: VWAPState;
}

export interface IndicatorPayload {
    symbol: string;
    timeframe: string;
    time: number;
    ema9: number | null;
    ema21: number | null;
    ema50: number | null;
    rsi: number | null;
    vwap: number | null;
    atr: number | null;
}

@Injectable()
export class IndicatorService {
    private readonly logger = new Logger(IndicatorService.name);

    /** Map<`${symbol}:${timeframe}`, state> */
    private readonly states = new Map<string, SymbolTimeframeState>();
    private indicatorListeners: Array<(payload: IndicatorPayload) => void> = [];
    private unsubCandle: (() => void) | null = null;

    constructor(private readonly candleService: CandleService) {
        this.unsubCandle = this.candleService.onCandleUpdate((event) => {
            this.processCandle(event.symbol, event.timeframe, event.candle);
        });
        this.logger.log('IndicatorService subscribed to candle updates');
    }

    /**
     * Register a listener for indicator updates.
     */
    onIndicatorUpdate(listener: (payload: IndicatorPayload) => void): () => void {
        this.indicatorListeners.push(listener);
        return () => {
            this.indicatorListeners = this.indicatorListeners.filter((l) => l !== listener);
        };
    }

    // ── Core Computation Methods (public for testability) ─────────────────

    computeEMA(prevEMA: number | null, close: number, period: number): number {
        if (prevEMA === null) return close;
        const k = 2 / (period + 1);
        return close * k + prevEMA * (1 - k);
    }

    computeRSI(state: RSIState, close: number): { rsi: number | null; state: RSIState } {
        const newState = { ...state };

        if (newState.prevClose === null) {
            newState.prevClose = close;
            newState.count = 1;
            return { rsi: null, state: newState };
        }

        const change = close - newState.prevClose;
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? -change : 0;

        newState.count++;
        newState.prevClose = close;

        if (newState.count <= newState.period) {
            // Accumulating initial period
            newState.avgGain += gain / newState.period;
            newState.avgLoss += loss / newState.period;

            if (newState.count === newState.period) {
                const rs = newState.avgLoss === 0 ? 100 : newState.avgGain / newState.avgLoss;
                const rsi = 100 - 100 / (1 + rs);
                return { rsi, state: newState };
            }

            return { rsi: null, state: newState };
        }

        // Wilder smoothing
        newState.avgGain = (newState.avgGain * (newState.period - 1) + gain) / newState.period;
        newState.avgLoss = (newState.avgLoss * (newState.period - 1) + loss) / newState.period;

        const rs = newState.avgLoss === 0 ? 100 : newState.avgGain / newState.avgLoss;
        const rsi = 100 - 100 / (1 + rs);

        return { rsi, state: newState };
    }

    computeATR(state: ATRState, candle: CandlePayload): { atr: number | null; state: ATRState } {
        const newState = { ...state };

        if (newState.prevCandle === null) {
            newState.prevCandle = candle;
            return { atr: null, state: newState };
        }

        const tr = Math.max(
            candle.high - candle.low,
            Math.abs(candle.high - newState.prevCandle.close),
            Math.abs(candle.low - newState.prevCandle.close),
        );

        newState.prevCandle = candle;
        newState.count++;

        if (newState.count <= newState.period) {
            newState.atrSum += tr;
            if (newState.count === newState.period) {
                newState.currentATR = newState.atrSum / newState.period;
                return { atr: newState.currentATR, state: newState };
            }
            return { atr: null, state: newState };
        }

        // Wilder smoothing for ATR
        newState.currentATR = (newState.currentATR * (newState.period - 1) + tr) / newState.period;
        return { atr: newState.currentATR, state: newState };
    }

    computeVWAP(state: VWAPState, candle: CandlePayload): { vwap: number; state: VWAPState } {
        const candleDate = new Date(candle.time * 1000).toISOString().split('T')[0];
        const newState = { ...state };

        // Reset at session boundary (new day)
        if (newState.sessionDate !== candleDate) {
            newState.cumulativeTPV = 0;
            newState.cumulativeVolume = 0;
            newState.sessionDate = candleDate;
        }

        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        newState.cumulativeTPV += typicalPrice * candle.volume;
        newState.cumulativeVolume += candle.volume;

        const vwap = newState.cumulativeVolume > 0
            ? newState.cumulativeTPV / newState.cumulativeVolume
            : typicalPrice;

        return { vwap, state: newState };
    }

    // ── Private Methods ────────────────────────────────────────────────────

    private getOrCreateState(symbol: string, timeframe: string): SymbolTimeframeState {
        const key = `${symbol}:${timeframe}`;
        let state = this.states.get(key);

        if (!state) {
            state = {
                ema9: null,
                ema21: null,
                ema50: null,
                rsiState: { period: 14, prevClose: null, avgGain: 0, avgLoss: 0, count: 0 },
                atrState: { period: 14, prevCandle: null, atrSum: 0, count: 0, currentATR: 0 },
                vwapState: { cumulativeTPV: 0, cumulativeVolume: 0, sessionDate: null },
            };
            this.states.set(key, state);
        }

        return state;
    }

    private processCandle(symbol: string, timeframe: string, candle: CandlePayload): void {
        const state = this.getOrCreateState(symbol, timeframe);

        // EMA updates
        state.ema9 = this.computeEMA(state.ema9, candle.close, 9);
        state.ema21 = this.computeEMA(state.ema21, candle.close, 21);
        state.ema50 = this.computeEMA(state.ema50, candle.close, 50);

        // RSI update
        const rsiResult = this.computeRSI(state.rsiState, candle.close);
        state.rsiState = rsiResult.state;

        // ATR update
        const atrResult = this.computeATR(state.atrState, candle);
        state.atrState = atrResult.state;

        // VWAP update
        const vwapResult = this.computeVWAP(state.vwapState, candle);
        state.vwapState = vwapResult.state;

        const payload: IndicatorPayload = {
            symbol,
            timeframe,
            time: candle.time,
            ema9: roundTo(state.ema9, 5),
            ema21: roundTo(state.ema21, 5),
            ema50: roundTo(state.ema50, 5),
            rsi: rsiResult.rsi !== null ? roundTo(rsiResult.rsi, 2) : null,
            vwap: roundTo(vwapResult.vwap, 5),
            atr: atrResult.atr !== null ? roundTo(atrResult.atr, 5) : null,
        };

        for (const listener of this.indicatorListeners) {
            try {
                listener(payload);
            } catch (err) {
                this.logger.error('Indicator listener error', err);
            }
        }
    }
}

function roundTo(value: number | null, decimals: number): number | null {
    if (value === null) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
}
